---
title: "Postgres 19 Feature Preview: pg_stat_statements Gets Better Normalization and Plan Counters"
description: "Postgres 19 adds IN-clause parameter normalization for prepared statements, FETCH size normalization, and generic/custom plan counters to pg_stat_statements — fixing the biggest operational pain points at scale."
date: "2026-02-17"
---

`pg_stat_statements` is the most widely deployed PostgreSQL extension. It tracks execution statistics per unique query and is the foundation of nearly every PostgreSQL monitoring stack. But it has a well-known scaling problem: entry bloat.

The extension stores one entry per unique query. When trivially different query variants — like `IN` lists with 3 vs. 5 vs. 20 parameters — each get their own entry, the fixed-size hash table fills up fast. When it hits `pg_stat_statements.max`, PostgreSQL evicts the least-used half of all entries in bulk, holding a spinlock that blocks concurrent access and throwing away data you actually need.

Postgres 19 addresses this with three targeted changes to `pg_stat_statements` (version 1.12 → 1.13), all committed during the [PG19-1 CommitFest by Sami Imseih](https://commitfest.postgresql.org/53/).

## Better Query Normalization

PostgreSQL 18 introduced IN-list normalization for literal constants (commit [62d712ec](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=62d712ec)), collapsing queries like `WHERE id IN (1, 2, 3)` and `WHERE id IN (1, 2, 3, 4, 5)` into one entry. But it didn't apply to external parameters — which is how every real application sends queries. JDBC, libpq, pgx, psycopg all use the extended query protocol:

```sql
SELECT * FROM users WHERE id IN ($1, $2, $3)       -- 3 params → queryid AAA
SELECT * FROM users WHERE id IN ($1, $2, $3, $4)   -- 4 params → queryid BBB
```

This was [described on pgsql-hackers](https://www.postgresql.org/message-id/CAA5RZ0tRXoPG2y6bMgBCWNDt0Tn=unRerbzYM=oW0syi1=C1OA@mail.gmail.com) as "a pretty big gap." ORMs routinely generate IN-lists with varying parameter counts for batch loading — each unique count was a separate entry.

Commit [c2da1a5d6](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=c2da1a5d6) closes this gap by extending the query jumbling logic to squash `PARAM_EXTERN` nodes the same way it squashes `Const` nodes. Both forms now normalize to `WHERE id IN ($1 /*, ... */)`.

A similar fix applies to FETCH commands. Commit [bee23ea4d](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=bee23ea4d) normalizes `FETCH 10 FROM cursor`, `FETCH 50 FROM cursor`, and `FETCH 100 FROM cursor` into a single entry `FETCH $1 FROM cursor`. Applications using server-side cursors with variable batch sizes — common in ETL pipelines — no longer pollute the stats table with hundreds of functionally identical entries.

## Generic/Custom Plan Counters

Commit [3357471cf](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=3357471cf) adds two new columns: `generic_plan_calls` and `custom_plan_calls`.

PostgreSQL uses a cost-based heuristic to choose between generic plans (cached, reusable) and custom plans (optimized per-execution with specific parameter values). After 5 executions, it may switch to a generic plan permanently — which can be dramatically slower if it chooses a sequential scan over an index scan. This "plan flipping" is one of the hardest performance issues to diagnose because, until now, nothing in `pg_stat_statements` indicated which plan type was used.

```sql
SELECT query, calls, generic_plan_calls, custom_plan_calls, mean_exec_time
FROM pg_stat_statements
WHERE generic_plan_calls > 0 AND custom_plan_calls > 0
ORDER BY mean_exec_time DESC;
```

Queries with high `generic_plan_calls` and poor `mean_exec_time` are candidates for `SET plan_cache_mode = force_custom_plan`. This is especially relevant for partitioned tables, where generic plans skip partition pruning.

## Closing Thoughts

All three changes address `pg_stat_statements` at production scale. The normalization fixes reduce entry bloat from the two most common sources — ORM-generated IN-lists and cursor FETCH operations. The plan counters fill an observability gap that has existed since prepared statements were introduced, surfacing plan-type information in the one place every DBA already looks.

## References

- [Postgres commit c2da1a5d6: Squash PARAM_EXTERN params in query jumbling](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=c2da1a5d6)
- [Postgres commit bee23ea4d: Normalize FETCH sizes in pg_stat_statements](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=bee23ea4d)
- [Postgres commit 3357471cf: Add generic/custom plan counters](https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=3357471cf)
- [pgsql-hackers: queryId constant squashing does not support prepared statements](https://www.postgresql.org/message-id/CAA5RZ0tRXoPG2y6bMgBCWNDt0Tn=unRerbzYM=oW0syi1=C1OA@mail.gmail.com)
- [pgsql-hackers: Improve explicit cursor handling in pg_stat_statements](https://www.mail-archive.com/pgsql-hackers@lists.postgresql.org/msg197030.html)

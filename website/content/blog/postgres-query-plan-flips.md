---
title: "Postgres Query Plan Flips: What They Are and How to Prevent Them"
description: "A single auto-ANALYZE flipped a query plan and knocked Clerk offline for 90 minutes. Here's how query plan flips happen and what you can do about them."
date: "2026-02-21"
---

On February 19, 2026, [Clerk went down for 90 minutes](https://clerk.com/blog/2026-02-19-system-outage-postmortem). Not a bad deploy, not a traffic spike. PostgreSQL's query planner picked a different execution plan after a routine `ANALYZE`, one hot query ate all database resources, and 95% of traffic started returning 429s.

If you run Postgres in production long enough, you'll hit this. A query that's been running in 2ms for months suddenly takes 20 seconds. Nothing changed in your code. The planner just decided to do something different.

## How the Planner Uses Statistics

PostgreSQL doesn't run your SQL literally. It evaluates execution strategies and picks the cheapest one based on table statistics — row counts, value distributions, NULL ratios — stored in `pg_statistic`. The `ANALYZE` command updates these statistics by sampling rows from each table. Autovacuum triggers this automatically in the background.

The sample size is controlled by `default_statistics_target` (default: 100). That translates to roughly 30,000 sampled rows regardless of table size. For most columns, that's fine. For columns with extreme skew, it's a time bomb.

## What Happened at Clerk

Clerk had a column where 99.9996% of values were NULL. When `ANALYZE` sampled 30,000 rows from a table with millions, the sample happened to contain only NULLs. The planner concluded the NULL fraction was 100% and optimized the query plan around "this filter returns zero rows."

It actually returned 17,000 rows. The plan was wrong by 17,000x, the query went from fast to unusable, and because it was a high-frequency query, the database ground to a halt.

The fix? Re-run `ANALYZE`. The second sample was more representative, the planner switched back, and service recovered. But 90 minutes of downtime had already happened.

## What Makes Plan Flips Nasty

You won't catch these in CI. They don't correlate with deploys. Autovacuum runs on its own schedule, and the same `ANALYZE` on the same data can produce different statistics depending on which rows get sampled. Your monitoring shows a latency spike, but nothing in your dashboard tells you _why_ — the plan changed, not the query.

And the failure mode is a cliff, not a slope. You don't get a 10% degradation. You get a query that switches from an index scan to a sequential scan on a 500GB table.

## What You Can Do

The most direct fix is increasing the statistics target on columns with skewed distributions. If a column is 99.99% NULLs, or has a handful of values that account for most rows, the default sample isn't large enough:

```sql
ALTER TABLE sessions ALTER COLUMN rare_field SET STATISTICS 1000;
ANALYZE sessions;
```

The maximum is 10,000. Bigger samples cost more `ANALYZE` time but dramatically reduce the chance of a bad estimate on skewed data. Clerk's remediation included exactly this.

For prepared statements, there's a separate flip to worry about. After 5 executions, PostgreSQL may switch from a custom plan (optimized for your specific parameter values) to a generic plan (cached and reused). On partitioned tables this can skip partition pruning entirely. If you know a query always needs custom plans:

```sql
SET plan_cache_mode = 'force_custom_plan';
```

Postgres 19 makes plan flips more visible by adding `generic_plan_calls` and `custom_plan_calls` columns to `pg_stat_statements`. On earlier versions, you're watching for sudden jumps in `mean_exec_time` on queries that were previously stable.

The other habit worth building: run `EXPLAIN` on your critical queries after major data loads, schema changes, or manual `ANALYZE` runs. If the plan changed, you want to know before traffic hits it.

## The Elephant in the Room: No Plan Management

This is where PostgreSQL genuinely falls behind Oracle and SQL Server.

Oracle has had [SQL Plan Management](https://docs.oracle.com/database/121/TGSQL/tgsql_spm.htm) (SPM) since 11g. When the optimizer finds a new plan for a query, it doesn't use it immediately. It goes into a holding pen. The database keeps running the accepted baseline plan until the new one is verified to perform at least as well. Plan flips like Clerk's simply don't happen — the optimizer is constrained to a set of known-good plans, and new plans must prove themselves first.

SQL Server has [Query Store](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store) with plan forcing. Every plan ever used for a query is recorded with its performance stats. If a regression happens, you can force the database back to the previous plan with one click. SQL Server 2017 went further with [automatic plan correction](https://learn.microsoft.com/en-us/sql/relational-databases/automatic-tuning/automatic-tuning) — it detects plan regressions on its own and reverts to the last known good plan without any human intervention. The Clerk outage would have self-healed in minutes.

PostgreSQL has nothing equivalent built in. Your options are third-party extensions like [pg_hint_plan](https://github.com/ossc-db/pg_hint_plan) (optimizer hints, not plan locking) or [sr_plan](https://github.com/postgrespro/sr_plan) (save/restore plans, maintained by Postgres Pro). Amazon's Aurora PostgreSQL offers [Query Plan Management](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Optimize.overview.html) as a proprietary feature, but that doesn't help anyone running community Postgres.

This has been discussed on pgsql-hackers for over two decades. Plan stability first appeared as a [wishlist item for PostgreSQL 7.4](https://www.postgresql.org/message-id/87bs46y9fl.fsf@stark.dyndns.tv) back in 2002. The community's [official position on optimizer hints](https://wiki.postgresql.org/wiki/OptimizerHintsDiscussion) has been that they encourage masking problems rather than fixing root causes.

The most promising recent effort is Robert Haas's [`pg_plan_advice`](https://www.postgresql.org/message-id/CA+TgmoZ-Jh1T6QyWoCODMVQdhTUPYkaZjWztzP1En4=ZHoKPzw@mail.gmail.com), proposed on pgsql-hackers in October 2025. It's a contrib module that emits a mini-language describing a plan's key decisions — join order, scan types, parallelism — and lets you feed that back to constrain future plans. It's not Oracle SPM, but it's the first serious attempt at plan stability in core Postgres. The thread has been active through February 2026 with substantial community engagement, though nothing has been committed yet.

## Closing Thoughts

Clerk's outage is a textbook case. Extreme data skew, default statistics target, high-frequency query. Any one of those alone is fine. All three together, and a single unlucky `ANALYZE` sample takes down your service. The workarounds — raise statistics targets, monitor for plan changes, review plans after maintenance — are well-understood. But they're workarounds. Oracle and SQL Server solved this at the engine level years ago. Until Postgres catches up, plan stability is your problem, not the database's.

## References

- [Clerk Postmortem: February 19, 2026 System Outage](https://clerk.com/blog/2026-02-19-system-outage-postmortem)
- [PostgreSQL Documentation: Statistics Used by the Planner](https://www.postgresql.org/docs/current/planner-stats.html)
- [PostgreSQL Documentation: ANALYZE](https://www.postgresql.org/docs/current/sql-analyze.html)
- [PostgreSQL Documentation: Query Planning Configuration](https://www.postgresql.org/docs/current/runtime-config-query.html)
- [Oracle SQL Plan Management](https://docs.oracle.com/database/121/TGSQL/tgsql_spm.htm)
- [SQL Server Query Store](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store)
- [Aurora PostgreSQL Query Plan Management](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Optimize.overview.html)
- [pgsql-hackers: pg_plan_advice (Robert Haas, Oct 2025)](https://www.postgresql.org/message-id/CA+TgmoZ-Jh1T6QyWoCODMVQdhTUPYkaZjWztzP1En4=ZHoKPzw@mail.gmail.com)
- [pgsql-hackers: Plan stability wishlist (2002)](https://www.postgresql.org/message-id/87bs46y9fl.fsf@stark.dyndns.tv)
- [PostgreSQL Wiki: Optimizer Hints Discussion](https://wiki.postgresql.org/wiki/OptimizerHintsDiscussion)

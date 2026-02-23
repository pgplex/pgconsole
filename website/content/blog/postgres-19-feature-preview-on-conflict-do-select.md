---
title: "Postgres 19 Feature Preview: INSERT ... ON CONFLICT DO SELECT"
description: "Postgres 19 adds ON CONFLICT DO SELECT, letting you retrieve the existing conflicting row in a single statement — no extra round-trips, no dummy updates, no CTE workarounds."
date: "2026-02-23"
---

Every application that writes to a lookup table eventually hits the same problem: insert a row if it doesn't exist, and return its ID either way. PostgreSQL has supported `ON CONFLICT` since version 9.5, but `ON CONFLICT DO NOTHING` never returns the conflicting row — it silently skips it. The only workarounds involve extra round-trips, gratuitous updates, or hairy CTEs.

Postgres 19 closes this gap with a new conflict action: `ON CONFLICT DO SELECT`, committed February 12, 2026 (commit [88327092](https://git.postgresql.org/pg/commitdiff/88327092ff06c48676d2a603420089bf493770f3)) by Dean Rasheed.

## The Pattern Everyone Has Hacked Around

The classic get-or-create query looks like this:

```sql
-- Before Postgres 19: the CTE workaround
WITH ins AS (
  INSERT INTO tags (name) VALUES ('backend')
  ON CONFLICT (name) DO NOTHING
  RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM tags WHERE name = 'backend'
LIMIT 1;
```

This works, but it's fragile under concurrent load and requires PostgreSQL to execute an extra index scan on the conflict path. The other common alternative — `DO UPDATE SET name = EXCLUDED.name` — forces a write and bumps `xmax`, creating dead tuples for no reason. Neither approach is satisfying, and both have been widely discussed on Stack Overflow and the pgsql-hackers list for years.

## The New Syntax

```sql
-- Postgres 19: one statement, no workarounds
INSERT INTO tags (name) VALUES ('backend')
ON CONFLICT (name) DO SELECT
RETURNING id, name;
```

When the insert succeeds, `RETURNING` gives you the new row. When a conflict is detected, `DO SELECT` fetches the existing row and returns it through the same `RETURNING` clause. One statement, one result, correct either way.

The `RETURNING` clause is required when using `DO SELECT` — without it there would be nothing to return, so PostgreSQL rejects the statement at parse time.

## Row Locking

If the caller needs to hold a lock on the returned row — for a subsequent update within the same transaction — an optional locking mode can be specified:

```sql
INSERT INTO tags (name) VALUES ('backend')
ON CONFLICT (name) DO SELECT FOR UPDATE
RETURNING id;
```

`FOR SHARE` is also supported. The locking semantics match what you'd get from a standalone `SELECT ... FOR UPDATE` — the existing row is locked before being returned. This is useful when the returned ID feeds into a foreign-key insert that must not race with a concurrent delete.

## Closing Thoughts

`ON CONFLICT DO SELECT` solves a problem that has existed since upsert was introduced in PostgreSQL 9.5. The workarounds — CTEs, dummy updates, application-level retry loops — have been load-bearing hacks in production codebases for nearly a decade. ORMs like Django and ActiveRecord that generate get-or-create patterns can now target a single, semantically correct statement. The feature also works correctly with partitioned tables and row-level security, both of which were explicitly tested during the review cycle.

## References

- [Postgres commit 88327092: Add support for INSERT ... ON CONFLICT DO SELECT](https://git.postgresql.org/pg/commitdiff/88327092ff06c48676d2a603420089bf493770f3)
- [pgsql-hackers: INSERT ... ON CONFLICT DO SELECT [FOR ...] take 2](https://www.postgresql.org/message-id/2b5db2e6-8ece-44d0-9890-f256fdca9f7e@proxel.se)
- [pgsql-hackers: ON CONFLICT DO SELECT (take 3)](https://www.postgresql.org/message-id/d631b406-13b7-433e-8c0b-c6040c4b4663@Spark)

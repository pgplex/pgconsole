---
title: "Postgres 19 Feature Preview: ALTER TABLE SPLIT PARTITION and MERGE PARTITIONS"
description: "Postgres 19 adds native DDL commands to split and merge partitions, replacing a risky multi-step manual workflow that has been a persistent operational pain point since declarative partitioning launched."
date: "2026-02-18"
---

Declarative partitioning has been in PostgreSQL since version 10. But once you defined your partition layout, you were mostly stuck with it. If a monthly range partition ballooned to 200GB and you needed to break it into weekly partitions, or if you wanted to consolidate a year's worth of daily partitions into a single archive partition, there was no DDL command for either operation — only a manual sequence of `DETACH`, `INSERT ... SELECT`, and `ATTACH` across multiple steps, with an `ACCESS EXCLUSIVE` lock on the parent table the entire time.

Postgres 19 fixes this with two new DDL commands: `ALTER TABLE ... SPLIT PARTITION` and `ALTER TABLE ... MERGE PARTITIONS`, committed by Alexander Korotkov on December 14, 2025.

## Splitting a Partition

`SPLIT PARTITION` divides one existing partition into multiple new partitions. The original partition is replaced; any rows are redistributed into the new partitions automatically.

```sql
-- Before: one partition covering three regions
-- whatever_range_abc covers values ('a', 'b', 'c')

ALTER TABLE whatever_range
  SPLIT PARTITION whatever_range_abc INTO (
    PARTITION whatever_range_ab FOR VALUES IN ('a', 'b'),
    PARTITION whatever_range_c  FOR VALUES IN ('c')
  );
```

The typical scenario is a range partition that has grown too large. If your `events_2024_q1` partition is overwhelming its tablespace or dominating autovacuum, you can split it into monthly partitions without touching any other part of the table.

## Merging Partitions

`MERGE PARTITIONS` is the inverse: it combines multiple partitions into one. This is useful for archival workflows where you want to consolidate granular partitions into a coarser one, such as collapsing 365 daily partitions into a single yearly archive.

```sql
ALTER TABLE whatever_range
  MERGE PARTITIONS (whatever_range_c, whatever_range_de)
  INTO whatever_range_cde;
```

Both commands work for `RANGE` and `LIST` partitioning. Hash-partitioned tables are not supported.

## Why This Took Three Years

The feature was [first proposed in May 2022](https://www.postgresql.org/message-id/c73a1746-0cd0-6bdd-6b23-3ae0b7c0c582@postgrespro.ru) by Dmitry Koval at Postgres Professional. It was committed targeting PostgreSQL 17 in April 2024, then [reverted before the PG17 release](https://github.com/postgres/postgres/commit/3890d90c) after security issues were surfaced by Noah Misch and Robert Haas. It didn't make PG18 either. The December 2025 commit is the third attempt — this time it stuck.

## What the Previous Workaround Looked Like

Without these commands, restructuring a live partitioned table required:

1. `DETACH PARTITION` the source partition (acquires `ACCESS EXCLUSIVE` on parent)
2. Create the replacement partition(s) as standalone tables
3. `INSERT INTO new_part SELECT * FROM old_part WHERE ...` — full table scan, no lock, but can take hours
4. `ALTER TABLE parent ATTACH PARTITION new_part FOR VALUES ...` (acquires `ACCESS EXCLUSIVE` again)
5. `DROP TABLE old_part`

Getting this wrong — a range overlap, a partition boundary off by one, a failed insert midway — left you with inconsistent state and data in limbo. For a table with active writes, timing the two `ACCESS EXCLUSIVE` windows was itself a planning exercise. Oracle DBAs migrating to PostgreSQL frequently hit this gap.

## Locking Caveat

The current implementation holds `ACCESS EXCLUSIVE` on the parent table for the entire operation, including the tuple routing phase. This means all reads and writes to the partitioned table are blocked while data moves between partitions. For small or infrequently accessed partitions — historical data, archive tables, staging partitions — this is fine. For large, heavily loaded partitions, it is not. The commit message describes this as "a quite naive implementation" and explicitly notes it as a foundation for future work with reduced locking and possible parallelism.

## Closing Thoughts

`SPLIT PARTITION` and `MERGE PARTITIONS` close a long-standing gap in PostgreSQL's partitioning story. The manual DETACH/INSERT/ATTACH workaround worked, but it was fragile, slow, and required careful coordination around locks. Having DDL commands for these operations means partition restructuring is now a single statement, visible in `pg_dump`, and consistent with how every other schema change works in PostgreSQL.

## References

- [Commit f2e4cc42: Implement ALTER TABLE ... MERGE PARTITIONS ... command](https://github.com/postgres/postgres/commit/f2e4cc427951b7c46629fb7625a22f7898586f3a)
- [Commit 4b3d1736: Implement ALTER TABLE ... SPLIT PARTITION ... command](https://github.com/postgres/postgres/commit/4b3d173629f4cd7ab6cd700d1053af5d5c7c9e37)
- [pgsql-hackers: Add SPLIT PARTITION/MERGE PARTITIONS commands (original thread, May 2022)](https://www.postgresql.org/message-id/c73a1746-0cd0-6bdd-6b23-3ae0b7c0c582@postgrespro.ru)
- [Revert commit 3890d90c: Revert support for ALTER TABLE ... MERGE/SPLIT PARTITION(S) commands](https://github.com/postgres/postgres/commit/3890d90c)

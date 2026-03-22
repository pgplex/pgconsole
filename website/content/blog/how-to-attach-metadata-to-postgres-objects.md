---
title: "How to Attach Key-Value Metadata to PostgreSQL Objects"
description: "COMMENT ON is the pragmatic default, SECURITY LABEL gives namespacing but needs a C extension, and custom tables trade lifecycle safety for schema flexibility."
date: "2026-03-22"
---

Regulations like GDPR and CCPA require organizations to know which columns contain personal data, which tables hold financial records, and who owns each dataset. PostgreSQL has no native key-value property system on objects, so teams end up tracking this in spreadsheets or external catalogs that drift out of sync with the actual schema. You have three ways to store classification metadata directly in the database, each with real tradeoffs.

## COMMENT ON: One Slot, Every Tool Reads It

`COMMENT ON` stores a single text string per object in the `pg_description` catalog. It's transactional, cascade-deletes when the object is dropped, survives `pg_dump`/`pg_restore`, and every database tool reads it — pgAdmin, DBeaver, DataGrip, `\d+` in psql.

```sql
COMMENT ON COLUMN employees.ssn IS 'PII - sensitivity: high';
COMMENT ON COLUMN employees.email IS 'PII - sensitivity: medium';
COMMENT ON TABLE employees IS 'Contains PII, owner: people-team';
```

The limitation is obvious: one string, no structure, no namespacing. If a documentation tool already uses the comment on `employees` for its own purposes, your classification data has nowhere to go.

This hasn't stopped people. [pg_graphql](https://supabase.github.io/pg_graphql/configuration/) encodes configuration as `@graphql({"name": "Publication"})`. [PostGraphile](https://www.graphile.org/postgraphile/smart-tags/) uses `@name MyTable` smart tags. PostgREST reads description fields for OpenAPI output. The result is a growing collision problem — there's no way to partition the comment space, and any tool can silently overwrite another's metadata.

## SECURITY LABEL: Multiple Namespaced Strings

`SECURITY LABEL` was designed for mandatory access control systems like SELinux, but its underlying mechanism is a general-purpose metadata store. The `pg_seclabel` catalog keys on `(objoid, classoid, objsubid, provider)` — that extra `provider` column is the critical difference from `pg_description`. Each provider gets its own independent label per object.

```sql
SECURITY LABEL FOR data_classification ON COLUMN employees.ssn
    IS '{"pii": true, "sensitivity": "high", "regulation": "GDPR"}';
SECURITY LABEL FOR data_classification ON COLUMN employees.email
    IS '{"pii": true, "sensitivity": "medium", "regulation": "GDPR"}';
SECURITY LABEL FOR data_ownership ON TABLE employees
    IS '{"team": "people-team", "steward": "jane@example.com"}';
```

Classification and ownership live in separate namespaces on the same object without conflict. Labels live in a system catalog, so they're transactional, included in `pg_dump` output, and automatically removed when the labeled object is dropped — no orphaned metadata.

The catch: you cannot use `SECURITY LABEL` without a registered provider, and registering one requires a C extension that calls `register_label_provider()`. That means compiling a shared library and loading it via `shared_preload_libraries`. On self-managed PostgreSQL this is straightforward, but it rules out most managed cloud services where you can't load custom C extensions.

## Custom Table: Full Flexibility, No Safety Net

The third option is a plain table:

```sql
CREATE TABLE data_classification (
    objoid oid,
    objsubid int4 DEFAULT 0,
    sensitivity text NOT NULL,
    regulation text,
    retention_days int,
    owner_team text,
    PRIMARY KEY (objoid, objsubid)
);

INSERT INTO data_classification (objoid, objsubid, sensitivity, regulation, owner_team)
VALUES ('employees'::regclass, 4, 'high', 'GDPR', 'people-team');
-- objsubid 4 = the 4th column (ssn)
```

You get a proper typed schema — `sensitivity` can be an enum, `retention_days` an integer, `owner_team` a foreign key. No C extension required. But you lose the safety net: `DROP TABLE employees` leaves orphaned classification rows. OIDs are not stable across dump/restore cycles, so your metadata points at nothing — or worse, at the wrong object. You'd need DDL event triggers for cleanup and a name-resolution layer for portability, both of which are partial solutions at best.

## Closing Thoughts

There is no native key-value property system in PostgreSQL, and proposals for one haven't gained enough traction to land in core. For most teams, `COMMENT ON` with a JSON convention is the pragmatic choice — every tool already reads it. If you're building an extension that needs isolated, namespaced metadata with proper lifecycle management, `SECURITY LABEL` is the right mechanism despite the C extension requirement. Custom tables make sense when you need a typed schema for your classification data and can accept the lifecycle management burden.

## References

- [PostgreSQL Documentation: COMMENT](https://www.postgresql.org/docs/current/sql-comment.html)
- [PostgreSQL Documentation: SECURITY LABEL](https://www.postgresql.org/docs/current/sql-security-label.html)
- [PostgreSQL Documentation: pg_description catalog](https://www.postgresql.org/docs/current/catalog-pg-description.html)
- [PostgreSQL Documentation: pg_seclabel catalog](https://www.postgresql.org/docs/current/catalog-pg-seclabel.html)
- [Custom Properties for PostgreSQL Database Objects Without Core Patches](https://www.pgedge.com/blog/custom-properties-for-postgresql-database-objects-without-core-patches)

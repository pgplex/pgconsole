---
title: "Introducing pgconsole"
description: "A self-hosted PostgreSQL editor with built-in access control, audit logging, and AI assistance — all from a single binary, and a TOML."
date: "2026-02-09"
featured: true
---

We're excited to announce pgconsole 1.0 — a self-hosted PostgreSQL editor designed for teams that care about security, simplicity, and speed.

## Why pgconsole?

Most database tools fall into two camps: heavyweight platforms that require their own infrastructure, or lightweight editors that lack access control. pgconsole sits in the sweet spot — a single binary with everything you need.

## GitOps Native

Everything lives in `pgconsole.toml`. Connections, users, groups, access rules — all in one file. No database migrations, no admin panels. Review access changes in pull requests the same way you review code.

```toml
[[connections]]
id = "production"
url = "postgres://..."

[[auth.providers]]
type = "google"
client_id = "..."

[iam]
[[iam.policies]]
groups = ["engineering"]
connections = ["production"]
permissions = ["read", "explain"]
```

## Built-in Access Control

Seven permission levels — from `explain` (view query plans only) to `admin` (role and database management). Permissions are disjoint, not hierarchical, so you can grant exactly the access each team member needs.

## Audit Logging

Every query is logged with the user, connection, timestamp, and full SQL. No more guessing who ran that `DELETE` on production.

## Get Started

Install and start querying in under a minute:

```bash
npx @pgplex/pgconsole@latest
```

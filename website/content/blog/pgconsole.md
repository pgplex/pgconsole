---
title: "Introducing pgconsole"
description: "A self-hosted PostgreSQL editor with built-in access control, audit logging, and AI assistance — all from a single binary, and a TOML."
date: "2026-02-09"
featured: true
---

We're excited to announce pgconsole 1.0 — a self-hosted PostgreSQL editor designed for teams that care about security, simplicity, and speed.

## Why pgconsole?

Most database tools fall into two camps: heavyweight platforms that require their own infrastructure, or lightweight editors that lack access control. PostgreSQL-specific editors exist but feel outdated, while modern editors spread thin across dozens of databases. pgconsole is a modern editor built exclusively for PostgreSQL — a single binary with everything you need.

By targeting PostgreSQL alone, we optimize every layer of the experience: native database/schema/table navigation, a real PostgreSQL parser powering autocomplete, syntax highlighting, code folding, and formatting — not generic SQL heuristics, but accurate PostgreSQL semantics.

## GitOps Native

Everything lives in `pgconsole.toml`. Connections, users, groups, access rules — all in one file. No database migrations, no admin panels. Review access changes in pull requests the same way you review code.

```toml
[[connections]]
id = "production"
name = "Production"
host = "prod.example.com"
port = 5432
database = "myapp"
username = "app_user"
password = "prod_password"
ssl_mode = "require"

[[auth.providers]]
type = "google"
client_id = "..."
client_secret = "..."
```

## Built-in Access Control

Seven permission levels — from `explain` (view query plans only) to `admin` (role and database management). Permissions are disjoint, not hierarchical, so you can grant exactly the access each team member needs.

```toml
[[iam]]
connection = "production"
permissions = ["read", "explain"]
members = ["group:engineering"]

[[iam]]
connection = "production"
permissions = ["*"]
members = ["group:dba"]
```

## AI Assistant

Bring your own LLM — OpenAI, Anthropic Claude, or Google Gemini. pgconsole uses your database schema to generate, explain, fix, and rewrite SQL directly in the editor. It also evaluates change risk before you hit run.

```toml
[[ai.providers]]
id = "claude"
name = "Claude Sonnet"
vendor = "anthropic"
model = "claude-sonnet-4-20250514"
api_key = "sk-ant-..."
```

## Audit Logging

Every query is logged with the user, connection, timestamp, and full SQL. No more guessing who ran that `DELETE` on production. Logs are emitted as JSON to stdout, so you can stream them directly to your SIEM of choice — Splunk, ELK, or any log aggregator.

## Open Source

Connecting to your database is sensitive — so the entire codebase is public and available for inspection. pgconsole doesn't phone home. The only outbound connections are to your databases and, optionally, your configured AI provider.

## Get Started

Install and start querying in under a minute. See the [quickstart guide](https://docs.pgconsole.com/getting-started/quickstart) for full details.

```bash
npx @pgplex/pgconsole@latest
```

```bash
docker run -p 9876:9876 pgplex/pgconsole
```

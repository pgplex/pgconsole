> [!NOTE]
> pgplex: Modern Developer Stack for Postgres - **pgconsole** · [pgtui](https://github.com/pgplex/pgtui) · [pgschema](https://github.com/pgplex/pgschema) · [pgparser](https://github.com/pgplex/pgparser)

<p align="center">
  <a href="https://www.pgconsole.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pgplex/pgconsole/main/src/assets/logo-dark-full.svg" />
      <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/src/assets/logo-light-full.svg" alt="pgconsole" />
    </picture>
  </a>
</p>

<table align="center"><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/website/public/sql-editor-overview.webp" alt="pgconsole SQL editor" />
</td></tr></table>

**pgconsole** is a web-based PostgreSQL editor. Single binary, single config file, no database required. Connect your team to PostgreSQL with access control and audit logging built in.

<a href="https://www.star-history.com/#pgplex/pgconsole&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=pgplex/pgconsole&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=pgplex/pgconsole&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=pgplex/pgconsole&type=Date" />
 </picture>
</a>

## Installation

Visit https://docs.pgconsole.com/getting-started/quickstart

### Prerequisites

- Node.js 20+

### npm

```bash
npm install -g @pgplex/pgconsole
pgconsole --config pgconsole.toml
```

### npx

```bash
npx @pgplex/pgconsole --config pgconsole.toml
```

### Docker

```bash
docker run -p 9876:9876 -v /path/to/pgconsole.toml:/etc/pgconsole.toml pgplex/pgconsole
```

Run without `--config` to start in demo mode with a bundled sample database.

## Features

### SQL Editor

A full-featured SQL workspace with real-time intelligence powered by a PostgreSQL parser — not regex.

- **Autocomplete** — context-aware suggestions for tables, columns, joins, and CTEs
- **Formatting** — pretty-print or collapse SQL to one line
- **Error detection** — red underlines with hover tooltips
- **Code folding** — collapse `SELECT`, `WITH`, and other blocks
- **Function signature help** — parameter hints as you type

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/sql-editor/sql-editor-autocomplete.webp" alt="Autocomplete" />
</td></tr></table>

### Data Grid & Inline Editing

Query results appear in a virtual-scrolling grid. With `write` permission, you can edit data directly — all changes are staged locally and previewed before execution.

- Double-click a cell to edit, or use the row detail panel
- Add, delete, and duplicate rows
- Staged changes are color-coded: green (INSERT), amber (UPDATE), red (DELETE)
- Preview generated SQL and optionally run an AI risk assessment before executing

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/sql-editor/sql-editor-staged-changes.webp" alt="Staged changes preview" />
</td></tr></table>

### Schema Browser

Browse and inspect database objects — tables, views, materialized views, functions, and procedures — with full metadata, indexes, constraints, triggers, and grants.

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/sql-editor/sql-editor-schema-tab.webp" alt="Schema browser" />
</td></tr></table>

### AI Assistant

Generate, explain, fix, and rewrite SQL with an AI assistant that understands your schema context. Supports OpenAI, Anthropic, and Google providers.

- **Text-to-SQL** — describe a query in natural language, get SQL back
- **Explain SQL** — get plain-language explanations of any query
- **Fix SQL** — AI-powered error correction from inline linting
- **Rewrite SQL** — optimize queries for performance or readability
- **Risk assessment** — analyze staged changes for potential risks before execution

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/ai-assistant/ai-text-to-sql.webp" alt="AI Text-to-SQL" />
</td></tr></table>

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/ai-assistant/ai-risk-assessment.webp" alt="AI risk assessment" />
</td></tr></table>

### Database Access Control

Fine-grained IAM controls who can read, write, or administer each connection. Permissions are enforced at the application layer — no database roles needed.

- **Default deny** — users have no access unless a rule explicitly grants it
- **Connection-scoped** — permissions are granted per connection, not globally
- **Disjoint permissions** — `read`, `write`, `ddl`, `admin`, `explain`, `execute`, `export` are independent

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/database-access-control/iam-permission-denied.webp" alt="Permission denied" />
</td></tr></table>

<table><tr><td>
  <img src="https://raw.githubusercontent.com/pgplex/pgconsole/main/docs/images/features/database-access-control/iam-permission-badge.webp" alt="Permission badge" />
</td></tr></table>

### Audit Log

Every query and login is recorded as structured JSON to stdout. Filter and forward to your log infrastructure.

```json
{
  "type": "audit",
  "ts": "2024-01-15T10:32:15.456Z",
  "action": "sql.execute",
  "actor": "alice@example.com",
  "connection": "prod-db",
  "sql": "SELECT * FROM users WHERE active = true",
  "duration_ms": 45,
  "row_count": 150
}
```

### Single-File Configuration

Everything lives in `pgconsole.toml` — connections, users, groups, access rules, AI providers. No database required.

```toml
[[connections]]
id = "production"
name = "Production"
host = "db.example.com"
port = 5432
database = "myapp"
username = "readonly"
password = "..."

[[iam]]
connection = "production"
permissions = ["read", "explain", "export"]
members = ["*"]

[[iam]]
connection = "production"
permissions = ["*"]
members = ["group:dba"]

[[ai.providers]]
id = "claude"
vendor = "anthropic"
model = "claude-sonnet-4-20250514"
api_key = "sk-ant-..."
```

## Getting Help

- [Docs](https://www.pgconsole.com)
- [GitHub Issues](https://github.com/pgplex/pgconsole/issues)

## Development

> [!NOTE]
> **For external contributors**: If you want to request a feature, please create a GitHub issue to discuss first instead of creating a PR directly.

```bash
git clone https://github.com/pgplex/pgconsole.git
cd pgconsole
pnpm install
pnpm dev        # Start dev server (frontend + backend)
pnpm build      # Production build
pnpm test       # Run all tests
```

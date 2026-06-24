# MCP Server for pgconsole

## Context

Expose pgconsole as a **remote MCP server** so external AI agents (Claude Code,
Cursor, VS Code Copilot, Windsurf, etc.) can operate on the Postgres connections
pgconsole manages.

The differentiator vs. the stock Postgres MCP server (which hands an agent a raw
connection string) is **governance**: pgconsole already has per-connection IAM,
per-statement SQL permission detection, and audit logging. The MCP server is a thin
layer that inherits all of it — agents get *governed, audited, permission-gated*
database access.

Learnings absorbed from the "State of Postgres MCP Servers 2025" survey:
- The read-only-transaction **semicolon-breakout bypass** (`COMMIT; DROP SCHEMA`) that
  bit Anthropic's reference server does **not** apply here — `detectRequiredPermissions`
  parses and unions permissions over *every* statement
  (`server/lib/sql-permissions.ts:216`), so a DROP inside a "read" call still requires `ddl`.
- The **lethal trifecta** (private data + untrusted content + exfiltration) is
  unsolvable, only containable → least-privilege identity + audit, read-only by default.

## Decision

### Transport & identity
- **Streamable HTTP** MCP endpoint mounted on the existing Express server
  (`server/index.ts`), not stdio (pgconsole is a long-running server).
- **Token → user-email mapping** (PAT / API key in `pgconsole.toml`). Every MCP request
  resolves to an IAM identity, so `getUserPermissions(email, connectionId)` applies
  unchanged. This is the one genuinely new piece; everything downstream reuses existing code.
- **Read-only by default**: a token grants only the IAM permissions explicitly assigned.
  Write/ddl/admin are opt-in per token.

### Tools-first (baseline), Resources deferred
Schema discovery and execution are exposed as **tools**, because every mainstream client
supports tools but **Cursor, Windsurf, and Goose are tools-only** (no Resources). Resources
would be invisible to a large share of users, so they are an out-of-scope enhancement.

### Tool surface — one execution tool per disjoint IAM permission
The `tools/list` response is **filtered per token**: only tools whose IAM permission the
token holds (on ≥1 accessible connection) are exposed. The tool surface *is* the permission
set — clean IAM mapping and token-efficient by construction.

**Discovery** (require any permission on the connection → `requireAnyPermission`):

| Tool | Returns | Backs onto |
|------|---------|-----------|
| `list_connections` | Accessible connections | `getAccessibleConnectionIds` |
| `list_objects(connection, schema?, kind?, name_filter?, cursor?)` | Lightweight catalog: name, kind, est. rows, size, comment. Paginated + filterable. Schema omitted → schema names + counts. | `GetSchemas` / `GetTables` |
| `describe_table(connection, schema, table)` | Full detail for one object: columns/types, PK/FK, indexes, constraints, comments | `GetColumns` + `GetIndexes` + `GetConstraints` |

**Execution** (one per permission, shown only if the token holds it):

| Tool | IAM perm | Accepts |
|------|----------|---------|
| `explain_query` | `explain` | `EXPLAIN [ANALYZE]` — exposes Postgres options: `analyze`, `buffers`, `format=json` |
| `query` | `read` | SELECT / SHOW |
| `write_data` | `write` | INSERT / UPDATE / DELETE / COPY |
| `run_ddl` | `ddl` | CREATE / ALTER / DROP / GRANT / … |

### Enforcement rule (every execution tool for permission P)
1. Parse via `detectRequiredPermissions(sql)` → required set **R**.
2. **Reject if any statement's primary kind-permission ≠ P** (no smuggling a DROP through
   `query`; mixed-class multi-statement batches rejected — also closes the breakout vector).
3. **Enforce `R ⊆ token grants`** via `requirePermissions` — handles cross-cutting cases like
   `SELECT pg_terminate_backend()` (R = {read, admin}; denied unless token holds admin).
4. **Audit** via the existing path, tagged `source=mcp`, tool name, token identity.

### Large-schema handling
`list_objects` is paginated (cursor + `has_more`) and supports `name_filter`. The agent
navigates top-down and pays tokens only for objects it touches — never a full-schema dump.
No single-blob `describe_database` tool (it blows up context on large DBs).

## Steps

1. **Token identity** (`server/lib/config.ts` + auth middleware) → verify: a configured MCP
   token resolves to a user email; unknown token → 401.
   - Add MCP tokens to config (token → email); resolve to the same `{ email }` the RPC
     services already consume.
2. **MCP endpoint** (`server/index.ts`) → verify: an MCP client completes `initialize` and
   `tools/list` over streamable HTTP.
   - Mount an MCP server (SDK) on a new route behind the token-auth middleware.
3. **Dynamic tool list** → verify: a read-only token sees only
   `list_connections`/`list_objects`/`describe_table`/`explain_query`/`query`; a write token
   additionally sees `write_data`.
   - Filter advertised tools by `getUserPermissions` for the token's accessible connections.
4. **Discovery tools** → verify: `list_objects` paginates and filters on a large schema;
   `describe_table` returns full detail for one table.
5. **Execution tools** → verify: `query` runs a SELECT; `query` of a DROP is rejected;
   `SELECT pg_terminate_backend()` denied without admin; every call audited.
6. **Docs** (`docs/configuration/config.mdx` + a feature page) → verify: MCP token config and
   tool list documented.

## Out of scope (add later only if asked)
- **Resources / resource templates** — enhancement for resource-capable clients (Claude
  family, VS Code, Continue, Cline). Baseline ships tools only.
- `run_admin_sql` — highest blast radius; if needed, expose narrow typed tools
  (`list_sessions`, `terminate_session`) instead of arbitrary admin SQL.
- `call_procedure` (`execute`), `export` (no native MCP analog), `cancel_query`.
- Migration-generation tools — generation is the agent's job; execution goes through
  `run_ddl` + IAM.
- Read-only-transaction wrapping of `query` — defense-in-depth only; the per-statement
  parse already blocks the breakout.

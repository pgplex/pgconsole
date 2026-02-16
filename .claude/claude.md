# Project Guidelines

## Overview

pgconsole is a PostgreSQL management console with a React frontend and Express backend using ConnectRPC for API communication.

## Working Guidelines

### Plan Mode

When using plan mode, create the plan under `plans/` directory.

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

### SQL Analysis: Use the Parser, Not Regex

**NEVER use regex to parse or analyze SQL. Always use `@libpg-query/parser`.**

The codebase has a full SQL parser in `src/lib/sql/`:
- `core.ts` - `parseSql()` returns typed AST with statement kinds and expressions
- `server/lib/sql-permissions.ts` - Example of proper parser usage

```typescript
// ❌ WRONG - Don't do this
const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
const hasFunction = /pg_terminate_backend/i.test(sql)

// ✅ CORRECT - Use the parser
import { parseSql } from 'src/lib/sql/core'
const parsed = await parseSql(sql)
const stmt = parsed.statements[0]
if (stmt.kind === 'select') { /* ... */ }
```

The parser handles:
- Comments, string literals, quoted identifiers
- Multi-statement SQL
- Nested expressions and subqueries
- All PostgreSQL syntax

## Project Structure

```
/server              - Express backend with ConnectRPC services
  /lib               - Config, auth utilities
  /services          - RPC service implementations
/src                 - React frontend application
  /components        - React components
    /ui              - Reusable UI primitives (95+ components)
    /sql-editor      - SQL editor feature components
  /hooks             - Custom React hooks
  /lib               - Shared utilities
    /sql             - SQL parsing, formatting, autocomplete
      /autocomplete  - Autocomplete pipeline (8 modules)
  /gen               - Generated protobuf code
  /pages             - Page components
/proto               - Protocol buffer definitions
/scripts             - Build scripts
/tests               - Test suite (SQL parser, autocomplete, API)
/docs                - Documentation and design plans
/dist/client         - Built frontend (Vite output)
/dist/server.mjs     - Built server (esbuild output)
```

## Configuration

All configuration is done via `pgconsole.toml` (no environment variables required). See `docs/configuration/config.mdx` for the full reference. Source of truth for config fields: `server/lib/config.ts`.

### Provider Config Pattern

Both auth and AI providers use `[[array]]` of tables with a type/vendor discriminator:

```toml pgconsole.toml
# Auth providers — type discriminator, issuer_url required for keycloak/okta
[[auth.providers]]
type = "google"
client_id = "..."
client_secret = "..."

[[auth.providers]]
type = "keycloak"
client_id = "..."
client_secret = "..."
issuer_url = "https://keycloak.example.com/realms/myrealm"

# AI providers — vendor discriminator
[[ai.providers]]
id = "gpt4"
vendor = "openai"
model = "gpt-4o"
api_key = "sk-..."
```

**Types:** `AuthProviderConfig` (with `type` field) and `AIProviderConfig` (with `vendor` field) in `server/lib/config.ts`.

**Access:** Use `getAuthProvider(type)` to look up an auth provider by type. In OAuth route files, import `getAuthProvider` (not `getAuthConfig`).

### Config Docs Convention (`docs/configuration/config.mdx`)

When adding or updating config fields:
- **Section titles**: Human-readable (e.g., "Connections" not "`[[connections]]`")
- **Section order**: General → Labels → Connections → Authentication → Users → Groups → Access Control (IAM) → AI Providers
- **Each section**: Description → field table → TOML code example
- **Complete example** at top must follow the same section order
- **Required column**: Only mark `Yes` for required fields; leave cell empty for optional
- **Inline details**: Put formats/options in table descriptions, not separate subsections (e.g., SSL modes, timeout format)
- **Cross-reference**: Link to related docs pages and external references (e.g., PostgreSQL docs)
- **Config reference links**: When other docs reference config fields, link to `docs/configuration/config.mdx` with the specific anchor (e.g., `/configuration/config#users`, `/configuration/config#oauth-providers`), not a generic link to the whole page
- **Verify against source**: `server/lib/config.ts` is the canonical SSOT for all config fields. Always check it (`loadConfig`) for field names, types, and whether they're optional

### Docs Screenshot Convention

- **Format**: WebP (`.webp`), quality 90, dimensions 1440x900 (1x)
- **Location**: `docs/images/` mirroring the `docs/` structure (e.g., `docs/images/features/sql-editor/`)
- **Reference**: `![Alt text](/images/features/<feature>/<image>.webp)`
- **Tool**: Use `/take-doc-screenshots` skill to capture screenshots from the running app
- **Prerequisites**: `pnpm dev` running, `shot-scraper` + `cwebp` installed

## Permission System (IAM)

### Permission Levels

Seven permission levels control what users can do per connection:

| Permission | Operations | Use Case |
|------------|------------|----------|
| `explain` | EXPLAIN | View query plans |
| `read` | SELECT, SHOW | Query execution |
| `execute` | CALL | Stored procedure execution |
| `export` | CSV export button | Client-side data export |
| `write` | INSERT, UPDATE, DELETE, COPY | Data modification |
| `ddl` | CREATE, ALTER, DROP | Schema changes |
| `admin` | Role/database management, dangerous functions | Database administration |

Permissions are **disjoint** (not hierarchical). A query like `SELECT pg_terminate_backend(123)` requires both `read` AND `admin`.

### Backend SQL Permission Detection

The server uses `@libpg-query/parser` to detect required permissions from SQL:

```
server/lib/sql-permissions.ts
├── getRequiredPermission(kind)     → Maps statement type to permission
├── extractFunctionsFromStatement() → Extracts function calls from AST
├── getFunctionPermission(name)     → Looks up function permission
└── detectRequiredPermissions(sql)  → Returns Set<Permission>
```

**Statement → Permission mapping:**
- `explain`: EXPLAIN
- `read`: SELECT, SHOW, SET, BEGIN/COMMIT
- `execute`: CALL
- `write`: INSERT, UPDATE, DELETE, COPY
- `ddl`: CREATE/ALTER/DROP TABLE/VIEW/INDEX/FUNCTION, GRANT, REVOKE
- `admin`: CREATE/DROP ROLE, CREATE/DROP DATABASE, ALTER SYSTEM

**Function permissions** are defined in `src/lib/sql/pg-system-functions.ts`:
- Most functions: `read`
- `pg_cancel_backend`, `pg_terminate_backend`: `admin`

**Safety:** Unparseable SQL defaults to `admin` permission.

### Frontend Permission Hook

Use `useConnectionPermissions` hook to check permissions in components:

```tsx
import { useConnectionPermissions } from '@/hooks/usePermissions'

function MyComponent({ connectionId }: { connectionId: string }) {
  const { hasWrite, hasDdl, hasAdmin, hasExplain, hasExport } = useConnectionPermissions(connectionId)

  return (
    <>
      {hasExplain && <Button onClick={handleExplain}>Explain</Button>}
      {hasExport && <Button onClick={handleExport}>Export</Button>}
      {hasWrite && <Button onClick={handleEdit}>Edit</Button>}
      {hasDdl && <Button onClick={handleAlter}>Alter Table</Button>}
      {hasAdmin && <Button onClick={handleTerminate}>Terminate</Button>}
    </>
  )
}
```

### Permission Gating Patterns

**Pattern 1: Direct gating in initiating components**
```tsx
// Gate buttons/actions that start write operations
{hasWrite && <Button onClick={handleDelete}>Delete</Button>}
```

**Pattern 2: Callback-based gating for child components**
```tsx
// Parent passes callbacks only when permitted
<ChildComponent
  onEdit={hasWrite ? handleEdit : undefined}
  onDelete={hasWrite ? handleDelete : undefined}
/>

// Child renders based on callback presence
{onEdit && <Button onClick={onEdit}>Edit</Button>}
```

**Pattern 3: Context-aware gating**
```tsx
// Disable features for read-only result types (e.g., EXPLAIN)
const isExplainResult = sql?.trim().toUpperCase().startsWith('EXPLAIN')
{hasWrite && !isExplainResult && <Button>Edit</Button>}
```

### Currently Gated Operations

**Backend (server-side enforcement):**

| Endpoint | Permission Detection |
|----------|---------------------|
| `ExecuteSQL` | Parsed from SQL (statement + functions) |
| `TerminateSession` | `admin` |

**Frontend (UI gating):**

| Component | Operation | Permission |
|-----------|-----------|------------|
| QueryResults.tsx | Add/Edit/Delete/Duplicate rows | `hasWrite` |
| QueryResults.tsx | Context menu actions | `hasWrite` |
| QueryResults.tsx | Double-click to edit | `hasWrite` |
| QueryResults.tsx | JSON modal save | `hasWrite` |
| FunctionSchemaContent.tsx | Edit function definition | `hasDdl` |
| ProcessesModal.tsx | Terminate process | `hasAdmin` |
| EditorArea.tsx | Explain button and context menu | `hasExplain` |
| QueryResults.tsx | Export to CSV button | `hasExport` |

### Adding New Gated Features

When adding features that modify data:
1. Identify the permission level needed (write/ddl/admin)
2. Use `useConnectionPermissions` in the component
3. Gate UI elements with the appropriate permission
4. For child components, pass callbacks conditionally
5. Consider context (e.g., EXPLAIN results should be read-only)

## Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build**: Vite (rolldown-vite)
- **Styling**: Tailwind CSS v4
- **UI Base**: @base-ui/react
- **Icons**: lucide-react
- **Routing**: react-router-dom v7
- **Data Fetching**: TanStack React Query
- **Editor**: CodeMirror 6
- **SQL Parsing**: @libpg-query/parser (WASM)

### Backend
- **Framework**: Express 5
- **RPC**: ConnectRPC
- **Database**: postgres.js (postgres), pg
- **Auth**: jose (JWT)
- **Config**: smol-toml

## Frontend Architecture

### Key Directories

- `src/components/sql-editor/` - Main editor feature
  - `SQLEditorLayout.tsx` - Main container with resizable panels
  - `QueryEditor.tsx` - CodeMirror-based SQL editor
  - `QueryResults.tsx` - Results grid with inline editing
  - `ContextPanel.tsx` - Right panel for object details
  - `hooks/useEditorTabs.ts` - Tab state management
  - `schema/` - Schema display components (tables, views, functions)

- `src/lib/` - Shared utilities
  - `connect-client.ts` - ConnectRPC client setup
  - `schema-store.ts` - In-memory schema cache (Map-based)
  - `staged-changes.ts` - DML change tracking for inline editing

- `src/lib/sql/` - SQL tooling
  - `autocomplete/` - 8-module autocomplete pipeline
  - `pg-highlight.ts` - Syntax highlighting
  - `pg-lint.ts` - Error detection
  - `pg-signature-help.ts` - Function signature tooltips
  - `format.ts` - SQL formatting

### State Management

**Server State**: TanStack React Query with query keys pattern `[resource, id, params]`

**Local State**: Custom hooks with localStorage persistence
- Tab content/state → `pgconsole-editor-{connectionId}`
- Layout (panel sizes) → `pgconsole-layout-{connectionId}`

**Schema Cache**: Non-React `schemaStore` object (connection-scoped Map)

### Editor Tab System

```typescript
type EditorTab = QueryTab | SchemaTab

interface QueryTab {
  type: 'query'
  id: string
  name: string
  content: string
}

interface SchemaTab {
  type: 'schema'
  id: string
  name: string
  schema: string
  table: string
  objectType?: 'table' | 'view' | 'materialized_view' | 'function' | 'procedure'
}
```

## UI Component Library

Located in `src/components/ui/`. Always use these instead of plain HTML elements.

### Form Controls
- `input.tsx`, `textarea.tsx`, `select.tsx`
- `checkbox.tsx`, `checkbox-group.tsx`, `radio-group.tsx`
- `switch.tsx`, `slider.tsx`, `number-field.tsx`

### Buttons & Interactive
- `button.tsx`, `toggle.tsx`, `toggle-group.tsx`

### Layout
- `card.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`
- `scroll-area.tsx`, `tabs.tsx`, `accordion.tsx`, `collapsible.tsx`

### Dialogs & Overlays
- `dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`, `tooltip.tsx`

### Feedback
- `alert.tsx`, `toast.tsx`, `progress.tsx`, `spinner.tsx`, `skeleton.tsx`

### Data Display
- `table.tsx`, `badge.tsx`, `avatar.tsx`, `kbd.tsx`

### Advanced
- `combobox.tsx`, `autocomplete.tsx`, `command.tsx`

**Usage:**
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
```

## Server Architecture

### Auth Routes (`/server/auth-routes.ts`)
- `POST /api/auth/login` - Basic auth
- `GET /api/auth/session` - Current session
- `POST /api/auth/logout` - Logout
- `GET /api/auth/providers` - List providers
- OAuth: `/api/auth/google`, `/api/auth/keycloak` + callbacks

### ConnectRPC Services

**ConnectionService** (`/server/services/connection-service.ts`)
- `ListConnections` - List all configured connections
- `GetConnection` - Get connection details by ID
- `TestConnection` - Test connection with latency measurement

**QueryService** (`/server/services/query-service.ts`)
- `ExecuteSQL` - Execute SQL (streaming response with PID, returns affected rows for DML)
- `CancelQuery` - Cancel running query by PID
- `GetSchemas` - List schemas
- `GetTables` - List tables in schema
- `GetColumns` - Get columns for table (with metadata)
- `GetTableInfo` - Full table metadata (size, row count, etc.)
- `GetIndexes`, `GetConstraints`, `GetTriggers` - Table structure
- `GetPolicies`, `GetGrants` - Security info
- `GetMaterializedViews`, `GetFunctions`, `GetProcedures` - Object lists
- `GetFunctionInfo` - Function/procedure details with definition

**AIService** (`/server/services/ai-service.ts`)
- `ListAIProviders` - List configured AI providers
- `GenerateSQL` - Generate SQL from natural language
- `ExplainSQL` - Explain SQL query in plain language
- `FixSQL` - Fix SQL syntax errors
- `RewriteSQL` - Rewrite and optimize SQL
- `RefreshSchemaCache` - Refresh cached schema info

**Schema Caching for AI** (`/server/lib/schema-cache.ts`)

AI features use a backend schema cache to avoid expensive database queries on every request. Schema cache includes:
- Tables, views, materialized views (name, type, comments)
- Columns (name, type, nullable, defaults, comments)
- Constraints (primary keys, foreign keys, unique, check)
- Indexes (name, columns, unique flag)

Cache behavior:
- Automatically populated on first AI request
- Stored in-memory per connection
- Frontend can trigger refresh via `RefreshSchemaCache` RPC
- Shared across all AI operations (GenerateSQL, ExplainSQL, etc.)

### Config (`/server/lib/config.ts`)
- `loadConfig(path?)` - Load and validate TOML
- `getConnections()`, `getConnectionById(id)`
- `getAuthConfig()`, `isAuthEnabled()`
- `getAuthProvider(type)` - Find auth provider by type (`'google'`, `'keycloak'`, `'okta'`)
- `getExternalUrl()`

## SQL Autocomplete Pipeline

Located in `src/lib/sql/autocomplete/`. Eight modular components:

1. `tokenizer.ts` - Lexical analysis of SQL
2. `parser.ts` - Error-tolerant SQL parsing
3. `section-detector.ts` - Context detection (SELECT_COLUMNS, FROM, WHERE, etc.)
4. `scope-analyzer.ts` - Table aliases, CTEs, available columns
5. `candidate-generator.ts` - Generate completions based on context
6. `ranker.ts` - Rank by relevance and match type
7. `pipeline.ts` - Orchestrate the pipeline
8. `types.ts` - Shared type definitions

## Development

```bash
pnpm dev              # Full dev (gen + server + vite)
pnpm build            # Production build
pnpm build:server     # Server only
pnpm test             # All tests
pnpm test:parser      # SQL parser tests
pnpm test:format      # SQL formatter tests
pnpm test:autocomplete # Autocomplete pipeline tests
pnpm test:api         # API tests with Hurl
```

### Dev Mode
- Frontend: Vite dev server (port 5173) with proxy to backend
- Backend: esbuild watch + Node.js watch (port 9876)
- Proxy routes: `/api/*`, `/connection.v1.*`, `/query.v1.*` → `:9876`

### Production
- Server serves frontend from `dist/client`
- Single process on PORT (default 9876)

## Code Style

- Functional components with hooks
- Type imports: `import type { ... }`
- Tailwind utility classes for styling
- Keep components focused and composable
- Use existing UI components from `src/components/ui/`
- Use `clsx` and `tailwind-merge` for conditional classes

## Key Files

### Configuration
- `pgconsole.toml` - Application configuration
- `vite.config.ts` - Frontend build config
- `scripts/build-server.mjs` - Server build config

### Backend
- `server/index.ts` - Server entry point
- `server/lib/config.ts` - Config parsing and validation
- `server/lib/iam.ts` - Permission checking (requirePermission, getUserPermissions)
- `server/lib/sql-permissions.ts` - SQL permission detection using parser
- `server/lib/schema-cache.ts` - Backend schema cache for AI features
- `server/auth-routes.ts` - Auth endpoints
- `server/services/query-service.ts` - Core query execution
- `server/services/connection-service.ts` - Connection management
- `server/services/ai-service.ts` - AI-powered SQL features

### Frontend
- `src/App.tsx` - Route setup and auth redirect
- `src/components/sql-editor/SQLEditorLayout.tsx` - Main editor container
- `src/components/sql-editor/hooks/useEditorTabs.ts` - Tab state machine
- `src/lib/connect-client.ts` - RPC client setup
- `src/lib/schema-store.ts` - Schema caching
- `src/lib/sql/autocomplete/pipeline.ts` - Autocomplete orchestration

### Protocol Buffers
- `proto/connection.proto` - Connection service definition
- `proto/query.proto` - Query service definition (13 RPCs)
- `proto/ai.proto` - AI service definition (6 RPCs)

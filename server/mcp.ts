// Remote MCP server exposing pgconsole's governed Postgres access to external AI agents.
//
// Transport: Streamable HTTP mounted on the Express app (stateless, JSON responses).
// Identity:  Authorization: Bearer <token> → an agent (see [[agents]] in config). An agent is
//   either a standalone service account (authorized by `agent:<id>` IAM rules) or delegated
//   on behalf of a user (inheriting that user's grant, narrowed by optional caps).
// Governance: every tool reuses the existing IAM + per-statement SQL permission detection
//   + audit path. The advertised tool list is filtered per agent; each execution tool also
//   re-checks the permission on the specific connection before running.
import express, { type Request, type Response } from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { getConnections, getAgentByToken, type AgentConfig } from './lib/config'
import { withConnection, buildConnectionDetails, type ConnectionDetails } from './lib/db'
import { getAgentPermissions, type Permission } from './lib/iam'
import { detectRequiredPermissions } from './lib/sql-permissions'
import { auditSQL } from './lib/audit'

declare const __APP_VERSION__: string

const MCP_PATH = '/mcp'
const PAGE_SIZE = 100

// A resolved MCP caller — identity + audit actor for one agent. Permission resolution
// itself lives in iam.ts (getAgentPermissions), the single home for that decision.
export class Principal {
  readonly agentId: string
  readonly auditActor: string // human email (delegated) or `agent:<id>` (pure)

  constructor(private readonly agent: AgentConfig) {
    this.agentId = agent.id
    this.auditActor = agent.onBehalfOf ?? `agent:${agent.id}`
  }

  permissions(connectionId: string): Set<Permission> {
    return getAgentPermissions(this.agent, connectionId)
  }
}

// Connections the agent can touch and the union of its permissions across them. One
// permission lookup per connection.
function agentAccess(principal: Principal): { hasAccessible: boolean; union: Set<Permission> } {
  const union = new Set<Permission>()
  let hasAccessible = false
  for (const c of getConnections()) {
    const perms = principal.permissions(c.id)
    if (perms.size === 0) continue
    hasAccessible = true
    for (const p of perms) union.add(p)
  }
  return { hasAccessible, union }
}

// ---- Per-connection permission enforcement (mirrors iam.ts requireX, principal-aware) ----

function requireAny(principal: Principal, connectionId: string): void {
  if (principal.permissions(connectionId).size === 0) {
    throw new Error('Connection not found or not accessible')
  }
}

function requireOne(have: Set<Permission>, permission: Permission, action: string): void {
  if (!have.has(permission)) {
    throw new Error(`Permission denied: ${action} requires '${permission}' permission`)
  }
}

function requireAll(have: Set<Permission>, needed: Set<Permission>, action: string): void {
  const missing = [...needed].filter((p) => !have.has(p))
  if (missing.length > 0) {
    throw new Error(`Permission denied: ${action} requires '${missing.join("', '")}' permission`)
  }
}

// ---- Tool definitions (JSON Schema) ----

const connectionProp = { connection: { type: 'string', description: 'Connection ID (from list_connections)' } }

const TOOLS = {
  list_connections: {
    name: 'list_connections',
    description: 'List the Postgres connections this token can access, with the IAM permissions granted on each.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  list_objects: {
    name: 'list_objects',
    description:
      'Browse a connection\'s catalog. Omit `schema` to list schemas with object counts. With `schema`, returns a paginated, filterable list of tables/views (name, kind, estimated rows, size, comment). Navigate top-down; pass the `nextCursor` from a prior response as `cursor` to fetch the next page.',
    inputSchema: {
      type: 'object',
      properties: {
        ...connectionProp,
        schema: { type: 'string', description: 'Schema name. Omit to list schemas.' },
        kind: { type: 'string', enum: ['table', 'view', 'materialized_view'], description: 'Filter by object kind.' },
        nameFilter: { type: 'string', description: 'Case-insensitive substring match on object name.' },
        cursor: { type: 'string', description: 'Pagination cursor (`nextCursor`) returned by a prior call.' },
      },
      required: ['connection'],
      additionalProperties: false,
    },
  },
  describe_table: {
    name: 'describe_table',
    description: 'Full detail for one table/view: columns and types, primary/foreign keys, indexes, constraints, and comments.',
    inputSchema: {
      type: 'object',
      properties: {
        ...connectionProp,
        schema: { type: 'string', description: 'Schema name.' },
        table: { type: 'string', description: 'Table or view name.' },
      },
      required: ['connection', 'schema', 'table'],
      additionalProperties: false,
    },
  },
  explain_query: {
    name: 'explain_query',
    description:
      'Return the query plan for a single SELECT/SHOW statement. With `analyze` the statement is actually executed to gather runtime stats (requires the same permissions as running it).',
    inputSchema: {
      type: 'object',
      properties: {
        ...connectionProp,
        sql: { type: 'string', description: 'A single SELECT or SHOW statement (without the EXPLAIN prefix).' },
        analyze: { type: 'boolean', description: 'Run the statement and report actual timing (EXPLAIN ANALYZE).' },
        buffers: { type: 'boolean', description: 'Include buffer usage (requires analyze on most servers).' },
        format: { type: 'string', enum: ['text', 'json'], description: 'Output format (default text).' },
      },
      required: ['connection', 'sql'],
      additionalProperties: false,
    },
  },
  query: {
    name: 'query',
    description: 'Run a read-only query (SELECT / SHOW) and return the rows.',
    inputSchema: {
      type: 'object',
      properties: { ...connectionProp, sql: { type: 'string', description: 'A SELECT or SHOW statement.' } },
      required: ['connection', 'sql'],
      additionalProperties: false,
    },
  },
  write_data: {
    name: 'write_data',
    description: 'Run a data-modifying statement (INSERT / UPDATE / DELETE / COPY). Returns affected row count and any RETURNING rows.',
    inputSchema: {
      type: 'object',
      properties: { ...connectionProp, sql: { type: 'string', description: 'An INSERT, UPDATE, DELETE, or COPY statement.' } },
      required: ['connection', 'sql'],
      additionalProperties: false,
    },
  },
  run_ddl: {
    name: 'run_ddl',
    description: 'Run a schema-changing statement (CREATE / ALTER / DROP / GRANT / REVOKE / ...).',
    inputSchema: {
      type: 'object',
      properties: { ...connectionProp, sql: { type: 'string', description: 'A DDL statement.' } },
      required: ['connection', 'sql'],
      additionalProperties: false,
    },
  },
} as const

// Pure mapping from a token's access to the tool names it should see. The tool surface IS
// the permission set: discovery tools need ≥1 accessible connection; each execution tool
// appears only if the token holds its permission on ≥1 connection.
export function selectToolNames(hasAccessibleConnection: boolean, union: Set<Permission>): string[] {
  const names = ['list_connections']
  if (hasAccessibleConnection) {
    names.push('list_objects', 'describe_table')
  }
  if (union.has('explain')) names.push('explain_query')
  if (union.has('read')) names.push('query')
  if (union.has('write')) names.push('write_data')
  if (union.has('ddl')) names.push('run_ddl')
  return names
}

// Advertise only the tools this agent's permissions unlock.
function listToolsFor(principal: Principal) {
  const { hasAccessible, union } = agentAccess(principal)
  return selectToolNames(hasAccessible, union).map((name) => TOOLS[name as keyof typeof TOOLS])
}

// ---- Result helpers ----

const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, bigintReplacer, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function reqStr(args: Record<string, unknown>, name: string): string {
  const v = args[name]
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`'${name}' is required`)
  }
  return v
}

function optStr(args: Record<string, unknown>, name: string): string | undefined {
  const v = args[name]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') throw new Error(`'${name}' must be a string`)
  return v
}

// ---- Tool implementations ----

async function listConnections(principal: Principal) {
  const connections = getConnections()
    .map((c) => ({ c, perms: principal.permissions(c.id) }))
    .filter(({ perms }) => perms.size > 0)
    .map(({ c, perms }) => ({
      id: c.id,
      name: c.name,
      host: c.host,
      port: c.port,
      database: c.database,
      permissions: [...perms],
    }))
  return { connections }
}

async function listObjects(principal: Principal, args: Record<string, unknown>) {
  const connection = reqStr(args, 'connection')
  requireAny(principal, connection)
  const details = buildConnectionDetails(connection)
  if (!details) throw new McpError(ErrorCode.InvalidParams, 'Connection not found')

  const schema = optStr(args, 'schema')
  const kind = optStr(args, 'kind')
  const nameFilter = optStr(args, 'nameFilter')
  const cursor = optStr(args, 'cursor')

  return withConnection(
    details,
    async (sql) => {
      if (!schema) {
        const rows = await sql`
          SELECT n.nspname AS schema,
                 count(c.oid) FILTER (WHERE c.relkind IN ('r', 'p', 'v', 'm')) AS object_count
          FROM pg_namespace n
          LEFT JOIN pg_class c ON c.relnamespace = n.oid
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND n.nspname NOT LIKE 'pg_temp_%'
            AND n.nspname NOT LIKE 'pg_toast_temp_%'
          GROUP BY n.nspname
          ORDER BY n.nspname
        `
        return {
          schemas: rows.map((r: { schema: string; object_count: number }) => ({
            schema: r.schema,
            objectCount: Number(r.object_count),
          })),
        }
      }

      const relkinds =
        kind === 'table' ? ['r', 'p'] : kind === 'view' ? ['v'] : kind === 'materialized_view' ? ['m'] : ['r', 'p', 'v', 'm']

      const rows = await sql`
        SELECT c.relname AS name,
               CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' ELSE 'table' END AS kind,
               c.reltuples::bigint AS est_rows,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
               obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ${schema}
          AND c.relkind::text = ANY(${relkinds})
          AND (${nameFilter ?? null}::text IS NULL OR c.relname ILIKE '%' || ${nameFilter ?? null} || '%')
          AND (${cursor ?? null}::text IS NULL OR c.relname > ${cursor ?? null})
        ORDER BY c.relname
        LIMIT ${PAGE_SIZE + 1}
      `

      const hasMore = rows.length > PAGE_SIZE
      const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
      return {
        schema,
        objects: page.map((r: { name: string; kind: string; est_rows: bigint; size: string; comment: string | null }) => ({
          name: r.name,
          kind: r.kind,
          estimatedRows: Number(r.est_rows) < 0 ? 0 : Number(r.est_rows),
          size: r.size,
          comment: r.comment ?? '',
        })),
        // Opaque cursor for the next page (the last object name); omitted when there are no more.
        nextCursor: hasMore ? page[page.length - 1].name : undefined,
      }
    },
    principal.auditActor
  )
}

async function describeTable(principal: Principal, args: Record<string, unknown>) {
  const connection = reqStr(args, 'connection')
  requireAny(principal, connection)
  const details = buildConnectionDetails(connection)
  if (!details) throw new McpError(ErrorCode.InvalidParams, 'Connection not found')

  const schema = reqStr(args, 'schema')
  const table = reqStr(args, 'table')

  return withConnection(
    details,
    async (sql) => {
      const meta = await sql`
        SELECT CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' WHEN 'p' THEN 'table' ELSE 'table' END AS kind,
               obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ${schema} AND c.relname = ${table} AND c.relkind IN ('r', 'p', 'v', 'm')
      `
      if (meta.length === 0) {
        throw new Error(`Object not found: ${schema}.${table}`)
      }

      // Independent catalog lookups — pipeline them on the connection rather than awaiting in series.
      const [columns, indexes, constraints] = await Promise.all([
        sql`
        SELECT a.attname AS name,
               format_type(a.atttypid, a.atttypmod) AS type,
               NOT a.attnotnull AS nullable,
               COALESCE((SELECT true FROM pg_constraint con
                         WHERE con.conrelid = c.oid AND con.contype = 'p' AND a.attnum = ANY(con.conkey)), false) AS is_primary_key,
               pg_get_expr(d.adbin, d.adrelid) AS default_value,
               col_description(c.oid, a.attnum) AS comment
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = ${schema} AND c.relname = ${table} AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
      `,
        sql`
        SELECT i.relname AS name, ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
               am.amname AS method, pg_get_indexdef(ix.indexrelid) AS definition
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_am am ON am.oid = i.relam
        WHERE n.nspname = ${schema} AND t.relname = ${table}
        ORDER BY ix.indisprimary DESC, i.relname
      `,
        sql`
        SELECT con.conname AS name,
               CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
                                WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUDE' END AS type,
               pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ${schema} AND c.relname = ${table}
        ORDER BY con.contype, con.conname
      `,
      ])

      return {
        schema,
        table,
        kind: meta[0].kind as string,
        comment: (meta[0].comment as string | null) ?? '',
        columns: columns.map((r: { name: string; type: string; nullable: boolean; is_primary_key: boolean; default_value: string | null; comment: string | null }) => ({
          name: r.name,
          type: r.type,
          nullable: r.nullable,
          isPrimaryKey: r.is_primary_key,
          default: r.default_value ?? '',
          comment: r.comment ?? '',
        })),
        indexes: indexes.map((r: { name: string; is_unique: boolean; is_primary: boolean; method: string; definition: string }) => ({
          name: r.name,
          isUnique: r.is_unique,
          isPrimary: r.is_primary,
          method: r.method,
          definition: r.definition,
        })),
        constraints: constraints.map((r: { name: string; type: string; definition: string }) => ({
          name: r.name,
          type: r.type,
          definition: r.definition,
        })),
      }
    },
    principal.auditActor
  )
}

// Enforce the per-tool permission rule and execute. `expectedPerm` is the disjoint IAM
// permission this tool maps to; every statement's primary kind-permission must equal it
// (rejects smuggling a DROP through `query` and mixed-class batches), and the full required
// set (including function-derived permissions) must be a subset of the agent's grants.
async function execute(principal: Principal, tool: string, expectedPerm: Permission, args: Record<string, unknown>) {
  const connection = reqStr(args, 'connection')
  const rawSql = reqStr(args, 'sql')

  // Re-resolve the agent's permissions on this specific connection (tools/list filtering is
  // per-any-connection, so re-check here).
  const have = principal.permissions(connection)
  requireOne(have, expectedPerm, tool)

  const details = buildConnectionDetails(connection)
  if (!details) throw new McpError(ErrorCode.InvalidParams, 'Connection not found')

  const analysis = await detectRequiredPermissions(rawSql)
  if (analysis.statementCount === 0) {
    throw new Error('No SQL statement provided')
  }
  for (const primary of analysis.primaryPermissions) {
    if (primary !== expectedPerm) {
      throw new Error(
        `The '${tool}' tool only accepts statements requiring '${expectedPerm}', but a statement requires '${primary}'`
      )
    }
  }
  requireAll(have, analysis.permissions, tool)

  // Wrap safe multi-statement batches in a transaction so a mid-batch failure rolls back.
  const finalSql =
    analysis.statementCount > 1 && analysis.transactionSafe ? `BEGIN;\n${rawSql}\nCOMMIT;` : rawSql

  const result = await runAndAudit(principal, tool, connection, details, finalSql, rawSql)
  const rowCount = result.count ?? result.rows.length
  if (expectedPerm === 'read') {
    return { rowCount, columns: result.columns, rows: result.rows }
  }
  return { rowCount, rows: result.rows.length ? result.rows : undefined }
}

async function explainQuery(principal: Principal, args: Record<string, unknown>) {
  const connection = reqStr(args, 'connection')
  const innerSql = reqStr(args, 'sql')
  const have = principal.permissions(connection)
  requireOne(have, 'explain', 'explain_query')

  const details = buildConnectionDetails(connection)
  if (!details) throw new McpError(ErrorCode.InvalidParams, 'Connection not found')

  const analysis = await detectRequiredPermissions(innerSql)
  // EXPLAIN is for understanding read queries; restrict to a single read statement so that
  // EXPLAIN ANALYZE cannot execute writes/DDL or trigger side effects via an unexpected kind.
  if (analysis.statementCount !== 1 || analysis.primaryPermissions[0] !== 'read') {
    throw new Error('explain_query only supports a single SELECT or SHOW statement')
  }

  const analyze = args.analyze === true
  const buffers = args.buffers === true
  const format = optStr(args, 'format')
  if (format && format !== 'text' && format !== 'json') {
    throw new Error("'format' must be 'text' or 'json'")
  }

  // ANALYZE actually runs the statement, so require everything running it would require
  // (e.g. function-derived permissions). Plain EXPLAIN only plans, needing just 'explain'.
  if (analyze) {
    requireAll(have, analysis.permissions, 'explain_query (ANALYZE)')
  }

  const opts: string[] = []
  if (analyze) opts.push('ANALYZE')
  if (buffers) opts.push('BUFFERS')
  if (format) opts.push(`FORMAT ${format.toUpperCase()}`)
  const explainSql = `${opts.length ? `EXPLAIN (${opts.join(', ')})` : 'EXPLAIN'} ${innerSql}`

  const result = await runAndAudit(principal, 'explain_query', connection, details, explainSql, explainSql)
  const planRows = result.rows.map((r) => (r as Record<string, unknown>)['QUERY PLAN'])
  const plan = format === 'json' ? planRows[0] : planRows.join('\n')
  return { plan }
}

// Execute SQL, timing and auditing it as an MCP query tagged with origin, tool, and agent, and
// rethrow a plain Error on failure. `auditSql` is the text recorded (e.g. the raw statement),
// which may differ from `execSql` actually run (e.g. the EXPLAIN-wrapped or BEGIN/COMMIT form).
async function runAndAudit(
  principal: Principal,
  tool: string,
  connection: string,
  details: ConnectionDetails,
  execSql: string,
  auditSql: string
) {
  const actor = principal.auditActor
  const opts = { source: 'mcp' as const, tool, agent: principal.agentId }
  const start = Date.now()
  try {
    const result = await runStatement(details, execSql, actor)
    auditSQL(actor, connection, details.database, auditSql, true, Date.now() - start, result.count ?? result.rows.length, undefined, opts)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query execution failed'
    auditSQL(actor, connection, details.database, auditSql, false, Date.now() - start, undefined, message, opts)
    throw new Error(message)
  }
}

// Run one (possibly multi-statement) SQL string and normalize the postgres.js result.
// `appUser` tags the Postgres application_name for monitoring/correlation.
async function runStatement(
  details: ConnectionDetails,
  sql: string,
  appUser: string
): Promise<{ count: number | undefined; columns: string[]; rows: Record<string, unknown>[] }> {
  return withConnection(
    details,
    async (client) => {
      const result = (await client.unsafe(sql)) as unknown as Array<Record<string, unknown>> & {
        count?: number
        columns?: { name: string }[]
      }
      const rows = Array.from(result) as Record<string, unknown>[]
      const columns = result.columns?.map((c) => c.name) ?? (rows[0] ? Object.keys(rows[0]) : [])
      return { count: result.count, columns, rows }
    },
    appUser
  )
}

// ---- MCP server wiring ----

function buildServer(principal: Principal): Server {
  const server = new Server(
    { name: 'pgconsole', version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listToolsFor(principal) }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name
    const args = (req.params.arguments ?? {}) as Record<string, unknown>
    try {
      switch (name) {
        case 'list_connections':
          return textResult(await listConnections(principal))
        case 'list_objects':
          return textResult(await listObjects(principal, args))
        case 'describe_table':
          return textResult(await describeTable(principal, args))
        case 'explain_query':
          return textResult(await explainQuery(principal, args))
        case 'query':
          return textResult(await execute(principal, 'query', 'read', args))
        case 'write_data':
          return textResult(await execute(principal, 'write_data', 'write', args))
        case 'run_ddl':
          return textResult(await execute(principal, 'run_ddl', 'ddl', args))
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      }
    } catch (err) {
      if (err instanceof McpError) throw err
      return errorResult(err instanceof Error ? err.message : String(err))
    }
  })

  return server
}

export const mcpRouter = express.Router()

mcpRouter.post(MCP_PATH, async (req: Request, res: Response) => {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined
  const agent = token ? getAgentByToken(token) : undefined
  if (!agent) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized: a valid MCP bearer token is required' },
      id: null,
    })
    return
  }

  const server = buildServer(new Principal(agent))
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    transport.close()
    server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('MCP request error:', err instanceof Error ? err.message : err)
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null })
    }
  }
})

// Stateless transport: GET (SSE) and DELETE (session teardown) are not supported.
mcpRouter.all(MCP_PATH, (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
})

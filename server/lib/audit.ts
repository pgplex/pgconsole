// Audit logging - emits JSON lines to stdout
interface BaseEvent {
  type: 'audit'
  ts: string
  actor: string
}

interface AuthLoginEvent extends BaseEvent {
  action: 'auth.login'
  provider: string
  ip: string
  success: boolean
  error?: string
}

interface AuthLogoutEvent extends BaseEvent {
  action: 'auth.logout'
}

interface SQLExecuteEvent extends BaseEvent {
  action: 'sql.execute'
  connection: string
  database: string
  sql: string
  success: boolean
  duration_ms: number
  row_count?: number
  error?: string
  /** Set to 'mcp' when the query originated from the MCP server */
  source?: 'mcp'
  /** MCP tool name (only when source is 'mcp') */
  tool?: string
  /** Agent id that ran the query, when source is 'mcp' (present for both pure and delegated agents) */
  agent?: string
}

interface DataExportEvent extends BaseEvent {
  action: 'data.export'
  connection: string
  database: string
  sql: string
  row_count: number
  format: string
}

type AuditEvent = AuthLoginEvent | AuthLogoutEvent | SQLExecuteEvent | DataExportEvent

function emit(event: AuditEvent): void {
  console.log(JSON.stringify(event))
}

function now(): string {
  return new Date().toISOString()
}

export function auditLogin(actor: string, provider: string, ip: string, success: boolean, error?: string): void {
  const event: AuthLoginEvent = {
    type: 'audit',
    ts: now(),
    action: 'auth.login',
    actor,
    provider,
    ip,
    success,
  }
  if (error) event.error = error
  emit(event)
}

export function auditLogout(actor: string): void {
  emit({
    type: 'audit',
    ts: now(),
    action: 'auth.logout',
    actor,
  })
}

export function auditSQL(
  actor: string,
  connection: string,
  database: string,
  sql: string,
  success: boolean,
  duration_ms: number,
  row_count?: number,
  error?: string,
  // Set when the query came from the MCP server, to tag origin, tool, and agent.
  opts?: { source: 'mcp'; tool: string; agent: string }
): void {
  const event: SQLExecuteEvent = {
    type: 'audit',
    ts: now(),
    action: 'sql.execute',
    actor,
    connection,
    database,
    sql,
    success,
    duration_ms,
  }
  if (row_count !== undefined) event.row_count = row_count
  if (error) event.error = error
  if (opts) {
    event.source = opts.source
    event.tool = opts.tool
    event.agent = opts.agent
  }
  emit(event)
}

export function auditExport(
  actor: string,
  connection: string,
  database: string,
  sql: string,
  row_count: number,
  format: string
): void {
  emit({
    type: 'audit',
    ts: now(),
    action: 'data.export',
    actor,
    connection,
    database,
    sql,
    row_count,
    format,
  })
}

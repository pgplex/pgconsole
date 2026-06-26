import { getAuditRetentionDays } from './config'

// Audit logging - emits JSON lines to stdout and keeps recent entries in memory
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
  source: 'web'
  error?: string
}

interface AuthLogoutEvent extends BaseEvent {
  action: 'auth.logout'
  source: 'web'
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
  /** Origin channel of the query: web app or MCP server */
  source: 'web' | 'mcp'
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
  source: 'web'
}

export type AuditEvent = AuthLoginEvent | AuthLogoutEvent | SQLExecuteEvent | DataExportEvent

const auditEvents: AuditEvent[] = []

function pruneRetainedEvents(mode: 'prefix' | 'all'): void {
  const retentionDays = getAuditRetentionDays()
  if (retentionDays === undefined) return

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  if (mode === 'prefix') {
    let removeCount = 0
    for (const event of auditEvents) {
      if (Date.parse(event.ts) >= cutoff) break
      removeCount++
    }
    if (removeCount > 0) {
      auditEvents.splice(0, removeCount)
    }
  } else {
    let writeIndex = 0
    for (const event of auditEvents) {
      if (Date.parse(event.ts) >= cutoff) {
        auditEvents[writeIndex] = event
        writeIndex++
      }
    }
    if (writeIndex < auditEvents.length) {
      auditEvents.splice(writeIndex)
    }
  }
}

function emit(event: AuditEvent): void {
  auditEvents.push(event)
  pruneRetainedEvents('prefix')
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
    source: 'web',
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
    source: 'web',
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
    source: opts?.source ?? 'web',
  }
  if (row_count !== undefined) event.row_count = row_count
  if (error) event.error = error
  if (opts) {
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
    source: 'web',
  })
}

export function listAuditEvents(connectionId: string, limit: number): AuditEvent[] {
  pruneRetainedEvents('all')
  const entries: AuditEvent[] = []
  for (let i = auditEvents.length - 1; i >= 0 && entries.length < limit; i--) {
    const event = auditEvents[i]
    if ('connection' in event && event.connection === connectionId) {
      entries.push(event)
    }
  }
  return entries
}

// System-level audit events — instance-wide auth events not scoped to a connection,
// surfaced in the instance-owner-only "System" tab. Newest first, bounded by limit.
// Match by explicit action (not the absence of a `connection` field) so a future
// connection-less event can't silently leak into the System tab.
export function listSystemAuditEvents(limit: number): AuditEvent[] {
  pruneRetainedEvents('all')
  const entries: AuditEvent[] = []
  for (let i = auditEvents.length - 1; i >= 0 && entries.length < limit; i--) {
    const event = auditEvents[i]
    if (event.action === 'auth.login' || event.action === 'auth.logout') {
      entries.push(event)
    }
  }
  return entries
}

export function clearAuditEventsForTest(): void {
  auditEvents.length = 0
}

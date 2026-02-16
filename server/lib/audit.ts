// Audit logging - emits JSON lines to stdout
import { feature } from '../../src/lib/plan'
import { getPlan } from './config'

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
  if (!feature('AUDIT_LOG', getPlan())) return
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
  error?: string
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

import { execFile } from 'child_process'
import type { ConnectionConfig } from './config'

export interface PlanDiff {
  sql: string
  type: string
  operation: string
  path: string
  canRunInTransaction: boolean
}

export interface ParsedPlan {
  sourceFingerprint: string
  diffs: PlanDiff[]
  canRunInTransaction: boolean
  summary: string
}

export function parsePlanJson(json: {
  source_fingerprint: { hash: string }
  diffs: Array<{
    sql: string
    type: string
    operation: string
    path: string
    can_run_in_transaction: boolean
  }>
}): ParsedPlan {
  const diffs: PlanDiff[] = json.diffs.map(d => ({
    sql: d.sql,
    type: d.type,
    operation: d.operation,
    path: d.path,
    canRunInTransaction: d.can_run_in_transaction,
  }))

  const canRunInTransaction = diffs.length === 0 || diffs.every(d => d.canRunInTransaction)

  const counts = new Map<string, number>()
  for (const d of diffs) {
    counts.set(d.operation, (counts.get(d.operation) || 0) + 1)
  }

  let summary: string
  if (diffs.length === 0) {
    summary = 'No changes'
  } else {
    const parts: string[] = []
    for (const op of ['create', 'alter', 'drop']) {
      const count = counts.get(op)
      if (count) parts.push(`${count} to ${op}`)
    }
    summary = `${diffs.length} changes: ${parts.join(', ')}`
  }

  return { sourceFingerprint: json.source_fingerprint.hash, diffs, canRunInTransaction, summary }
}

export function runPgSchemaPlan(
  conn: ConnectionConfig,
  schemaFilePath: string,
  outputJsonPath: string,
  pgSchema: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'plan',
      '--host', conn.host,
      '--port', String(conn.port),
      '--db', conn.database,
      '--user', conn.username,
      ...(conn.password ? ['--password', conn.password] : []),
      '--sslmode', conn.ssl_mode || 'prefer',
      '--schema', pgSchema,
      '--file', schemaFilePath,
      '--output-json', outputJsonPath,
      '--no-color',
    ]

    execFile('pgschema', args, { timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`pgschema plan failed: ${stderr || error.message}`))
      } else {
        resolve()
      }
    })
  })
}

export function runPgSchemaApply(
  conn: ConnectionConfig,
  planJsonPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      'apply',
      '--host', conn.host,
      '--port', String(conn.port),
      '--db', conn.database,
      '--user', conn.username,
      ...(conn.password ? ['--password', conn.password] : []),
      '--sslmode', conn.ssl_mode || 'prefer',
      '--plan', planJsonPath,
      '--auto-approve',
      '--no-color',
      ...(conn.lock_timeout ? ['--lock-timeout', conn.lock_timeout] : []),
    ]

    execFile('pgschema', args, { timeout: 300_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`pgschema apply failed: ${stderr || error.message}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

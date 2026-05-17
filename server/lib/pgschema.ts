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

export interface PgSchemaPlanJson {
  schemas?: Record<string, {
    source_fingerprint?: { hash: string }
    groups?: Array<{
      can_run_in_transaction?: boolean
      steps: Array<{
        sql: string
        type: string
        operation: string
        path: string
      }>
    }>
  }>
}

export function parsePlanJson(json: PgSchemaPlanJson, schema: string): ParsedPlan {
  const schemaData = json.schemas?.[schema]
  const sourceFingerprint = schemaData?.source_fingerprint?.hash ?? ''

  const diffs: PlanDiff[] = []
  let canRunInTransaction = true
  for (const group of schemaData?.groups ?? []) {
    const groupTxn = group.can_run_in_transaction !== false
    if (!groupTxn) canRunInTransaction = false
    for (const step of group.steps) {
      diffs.push({
        sql: step.sql,
        type: step.type,
        operation: step.operation,
        path: step.path,
        canRunInTransaction: groupTxn,
      })
    }
  }

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

  return { sourceFingerprint, diffs, canRunInTransaction, summary }
}

function connectionArgs(conn: ConnectionConfig): string[] {
  return [
    '--host', conn.host,
    '--port', String(conn.port),
    '--db', conn.database,
    '--user', conn.username,
    ...(conn.password ? ['--password', conn.password] : []),
    '--sslmode', conn.ssl_mode || 'prefer',
  ]
}

function execPgSchema(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('pgschema', args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

export async function runPgSchemaPlan(
  conn: ConnectionConfig,
  schemaFilePath: string,
  outputJsonPath: string,
  pgSchema: string,
): Promise<void> {
  try {
    await execPgSchema([
      'plan',
      ...connectionArgs(conn),
      '--schema', pgSchema,
      '--file', schemaFilePath,
      '--output-json', outputJsonPath,
      '--no-color',
    ], 120_000)
  } catch (err) {
    throw new Error(`pgschema plan failed: ${(err as Error).message}`)
  }
}

export async function runPgSchemaApply(
  conn: ConnectionConfig,
  planJsonPath: string,
): Promise<string> {
  try {
    const { stdout } = await execPgSchema([
      'apply',
      ...connectionArgs(conn),
      '--plan', planJsonPath,
      '--auto-approve',
      '--no-color',
      ...(conn.lock_timeout ? ['--lock-timeout', conn.lock_timeout] : []),
    ], 300_000)
    return stdout
  } catch (err) {
    throw new Error(`pgschema apply failed: ${(err as Error).message}`)
  }
}

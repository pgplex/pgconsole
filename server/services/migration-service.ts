import { ConnectError, Code } from '@connectrpc/connect'
import type { ServiceImpl } from '@connectrpc/connect'
import { MigrationService } from '../../src/gen/migration_connect'
import { getConnectionById } from '../lib/config'
import type { ConnectionConfig } from '../lib/config'
import { withConnection, type ConnectionDetails } from '../lib/db'
import { getUserFromContext } from '../connect'
import { requirePermission } from '../lib/iam'
import { syncRepo, getRepoDir } from '../lib/git'
import { runPgSchemaPlan, runPgSchemaApply, parsePlanJson, type PgSchemaPlanJson } from '../lib/pgschema'
import { storePlan, getPlan, removePlan } from '../lib/plan-store'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

interface SchemaSource {
  repo: string
  branch: string
  path: string
  schema: string
}

function getConnectionDetails(conn: ConnectionConfig): ConnectionDetails {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: conn.password,
    sslMode: conn.ssl_mode || 'prefer',
    lockTimeout: conn.lock_timeout,
    statementTimeout: conn.statement_timeout,
  }
}

async function getSchemaSource(details: ConnectionDetails, email?: string): Promise<SchemaSource | null> {
  return withConnection(details, async (sql) => {
    const rows = await sql`
      SELECT 1 FROM pg_class WHERE relname = '_pgconsole' AND relkind = 'r'
    `
    if (rows.length === 0) return null

    const result = await sql`
      SELECT value FROM _pgconsole WHERE key = 'schema_source'
    `
    if (result.length === 0) return null

    const value = result[0].value as Record<string, unknown>
    if (!value.repo || typeof value.repo !== 'string') return null
    if (!value.path || typeof value.path !== 'string') return null

    return {
      repo: value.repo,
      branch: typeof value.branch === 'string' ? value.branch : 'main',
      path: value.path,
      schema: typeof value.schema === 'string' ? value.schema : 'public',
    }
  }, email)
}

function validateSchemaPath(repoDir: string, schemaPath: string): string {
  const resolved = resolve(repoDir, schemaPath)
  if (!resolved.startsWith(resolve(repoDir) + '/')) {
    throw new ConnectError('schema_source.path escapes the repository directory', Code.InvalidArgument)
  }
  return resolved
}

export const migrationServiceHandlers: ServiceImpl<typeof MigrationService> = {
  async planMigration(req, context) {
    if (!req.connectionId) {
      throw new ConnectError('connection_id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.connectionId)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, 'read', 'plan migration')

    const details = getConnectionDetails(conn)
    const schemaSource = await getSchemaSource(details, user?.email)
    if (!schemaSource) {
      throw new ConnectError(
        'No schema_source configured. Use SetMetadata to store a schema_source entry in the _pgconsole table.',
        Code.FailedPrecondition,
      )
    }

    const { repo, branch, path: schemaPath, schema: pgSchema } = schemaSource

    let commitHash: string
    try {
      const result = await syncRepo(req.connectionId, repo, branch)
      commitHash = result.commitHash
    } catch (err) {
      throw new ConnectError(
        `Failed to sync git repo: ${err instanceof Error ? err.message : String(err)}`,
        Code.Internal,
      )
    }

    const repoDir = getRepoDir(req.connectionId)
    const schemaFilePath = validateSchemaPath(repoDir, schemaPath)
    const outputJsonPath = join(tmpdir(), `pgconsole-plan-${randomUUID()}.json`)

    try {
      await runPgSchemaPlan(conn, schemaFilePath, outputJsonPath, pgSchema)
    } catch (err) {
      throw new ConnectError(
        `pgschema plan failed: ${err instanceof Error ? err.message : String(err)}`,
        Code.Internal,
      )
    }

    let planJson: PgSchemaPlanJson
    try {
      const raw = await readFile(outputJsonPath, 'utf-8')
      planJson = JSON.parse(raw) as PgSchemaPlanJson
    } catch (err) {
      throw new ConnectError(
        `Failed to read plan output: ${err instanceof Error ? err.message : String(err)}`,
        Code.Internal,
      )
    }

    const parsed = parsePlanJson(planJson, pgSchema)

    const planId = storePlan({
      connectionId: req.connectionId,
      planJsonPath: outputJsonPath,
      planData: planJson,
      schema: pgSchema,
    })

    return {
      planId,
      branch: branch || 'default',
      commitHash,
      sourceFingerprint: parsed.sourceFingerprint,
      diffs: parsed.diffs.map(d => ({
        sql: d.sql,
        type: d.type,
        operation: d.operation,
        path: d.path,
        canRunInTransaction: d.canRunInTransaction,
      })),
      canRunInTransaction: parsed.canRunInTransaction,
      summary: parsed.summary,
    }
  },

  async *applyMigration(req, context) {
    if (!req.connectionId) {
      throw new ConnectError('connection_id is required', Code.InvalidArgument)
    }
    if (!req.planId) {
      throw new ConnectError('plan_id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.connectionId)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, 'ddl', 'apply migration')

    const plan = getPlan(req.planId)
    if (!plan) {
      throw new ConnectError('Plan not found or expired. Please re-run plan.', Code.NotFound)
    }

    if (plan.connectionId !== req.connectionId) {
      throw new ConnectError('Plan does not match connection', Code.InvalidArgument)
    }

    const parsed = parsePlanJson(plan.planData as Parameters<typeof parsePlanJson>[0], plan.schema)
    const totalSteps = parsed.diffs.length

    yield {
      step: 0,
      totalSteps,
      sql: '',
      status: 'running',
      error: '',
    }

    try {
      await runPgSchemaApply(conn, plan.planJsonPath)
    } catch (err) {
      yield {
        step: totalSteps,
        totalSteps,
        sql: '',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      }
      return
    }

    yield {
      step: totalSteps,
      totalSteps,
      sql: '',
      status: 'completed',
      error: '',
    }

    removePlan(req.planId)
  },

  async getSchemaSourceStatus(req, context) {
    if (!req.connectionId) {
      throw new ConnectError('connection_id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.connectionId)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, 'read', 'check schema source status')

    const details = getConnectionDetails(conn)
    const schemaSource = await getSchemaSource(details, user?.email)

    if (!schemaSource) {
      return { configured: false, repo: '', branch: '', path: '', schema: '' }
    }

    return {
      configured: true,
      repo: schemaSource.repo,
      branch: schemaSource.branch,
      path: schemaSource.path,
      schema: schemaSource.schema,
    }
  },
}

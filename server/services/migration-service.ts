import { ConnectError, Code } from '@connectrpc/connect'
import type { ServiceImpl } from '@connectrpc/connect'
import { MigrationService } from '../../src/gen/migration_connect'
import { getConnectionById } from '../lib/config'
import { getUserFromContext } from '../connect'
import { requirePermission, requireAnyPermission } from '../lib/iam'
import { syncRepo, getRepoDir } from '../lib/git'
import { runPgSchemaPlan, runPgSchemaApply, parsePlanJson, type PgSchemaPlanJson } from '../lib/pgschema'
import { storePlan, getPlan, removePlan } from '../lib/plan-store'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

export const migrationServiceHandlers: ServiceImpl<typeof MigrationService> = {
  async planMigration(req, context) {
    if (!req.connectionId) {
      throw new ConnectError('connection_id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.connectionId)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    if (!conn.schema_source) {
      throw new ConnectError('Connection does not have a schema_source configured', Code.FailedPrecondition)
    }

    const user = await getUserFromContext(context.values)
    requireAnyPermission(user, req.connectionId)

    const { repo, branch, path: schemaPath, schema: pgSchema } = conn.schema_source

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
    const schemaFilePath = join(repoDir, schemaPath)
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

    for (let i = 0; i < totalSteps; i++) {
      yield {
        step: i + 1,
        totalSteps,
        sql: parsed.diffs[i].sql,
        status: 'running',
        error: '',
      }
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
    requireAnyPermission(user, req.connectionId)

    if (!conn.schema_source) {
      return { configured: false, repo: '', branch: '', path: '', schema: '' }
    }

    return {
      configured: true,
      repo: conn.schema_source.repo,
      branch: conn.schema_source.branch || '',
      path: conn.schema_source.path,
      schema: conn.schema_source.schema,
    }
  },
}

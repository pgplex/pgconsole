import { randomUUID } from 'crypto'
import type { PgSchemaPlanJson } from './pgschema'

const PLAN_TTL_MS = 30 * 60 * 1000

export interface StoredPlan {
  connectionId: string
  planJsonPath: string
  planData: PgSchemaPlanJson
  schema: string
  createdAt: number
}

const plans = new Map<string, StoredPlan>()

function evictExpired(): void {
  const now = Date.now()
  for (const [id, plan] of plans) {
    if (now - plan.createdAt > PLAN_TTL_MS) plans.delete(id)
  }
}

export function storePlan(opts: { connectionId: string; planJsonPath: string; planData: PgSchemaPlanJson; schema: string }): string {
  evictExpired()
  const id = randomUUID()
  plans.set(id, {
    connectionId: opts.connectionId,
    planJsonPath: opts.planJsonPath,
    planData: opts.planData,
    schema: opts.schema,
    createdAt: Date.now(),
  })
  return id
}

export function getPlan(planId: string): StoredPlan | undefined {
  const plan = plans.get(planId)
  if (!plan) return undefined
  if (Date.now() - plan.createdAt > PLAN_TTL_MS) {
    plans.delete(planId)
    return undefined
  }
  return plan
}

export function removePlan(planId: string): void {
  plans.delete(planId)
}

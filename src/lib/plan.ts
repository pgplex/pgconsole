export type PlanTier = 'FREE' | 'TEAM' | 'ENTERPRISE'

const PLAN_ORDER: Record<PlanTier, number> = {
  FREE: 0,
  TEAM: 1,
  ENTERPRISE: 2,
}

const FEATURE_PLAN = {
  GROUPS: 'TEAM',
  IAM: 'TEAM',
  SSO_GOOGLE: 'TEAM',
  SSO_KEYCLOAK: 'ENTERPRISE',
  SSO_OKTA: 'ENTERPRISE',
  BANNER: 'TEAM',
  AUDIT_LOG: 'ENTERPRISE',
} as const

export type Feature = keyof typeof FEATURE_PLAN

export function feature(name: Feature, plan: PlanTier): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER[FEATURE_PLAN[name]]
}

export function requiredPlan(name: Feature): PlanTier {
  return FEATURE_PLAN[name]
}

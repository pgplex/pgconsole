import { describe, it, expect } from 'vitest'
import { feature, requiredPlan } from '../src/lib/plan'

describe('feature', () => {
  it('FREE plan has no gated features', () => {
    expect(feature('GROUPS', 'FREE')).toBe(false)
    expect(feature('IAM', 'FREE')).toBe(false)
    expect(feature('SSO_GOOGLE', 'FREE')).toBe(false)
    expect(feature('SSO_KEYCLOAK', 'FREE')).toBe(false)
    expect(feature('SSO_OKTA', 'FREE')).toBe(false)
    expect(feature('BANNER', 'FREE')).toBe(false)
    expect(feature('AUDIT_LOG', 'FREE')).toBe(false)
  })

  it('TEAM plan includes TEAM features', () => {
    expect(feature('GROUPS', 'TEAM')).toBe(true)
    expect(feature('IAM', 'TEAM')).toBe(true)
    expect(feature('SSO_GOOGLE', 'TEAM')).toBe(true)
    expect(feature('BANNER', 'TEAM')).toBe(true)
  })

  it('TEAM plan excludes ENTERPRISE features', () => {
    expect(feature('SSO_KEYCLOAK', 'TEAM')).toBe(false)
    expect(feature('SSO_OKTA', 'TEAM')).toBe(false)
    expect(feature('AUDIT_LOG', 'TEAM')).toBe(false)
  })

  it('ENTERPRISE plan includes all features', () => {
    expect(feature('GROUPS', 'ENTERPRISE')).toBe(true)
    expect(feature('IAM', 'ENTERPRISE')).toBe(true)
    expect(feature('SSO_GOOGLE', 'ENTERPRISE')).toBe(true)
    expect(feature('SSO_KEYCLOAK', 'ENTERPRISE')).toBe(true)
    expect(feature('SSO_OKTA', 'ENTERPRISE')).toBe(true)
    expect(feature('BANNER', 'ENTERPRISE')).toBe(true)
    expect(feature('AUDIT_LOG', 'ENTERPRISE')).toBe(true)
  })
})

describe('requiredPlan', () => {
  it('returns minimum plan for each feature', () => {
    expect(requiredPlan('GROUPS')).toBe('TEAM')
    expect(requiredPlan('IAM')).toBe('TEAM')
    expect(requiredPlan('SSO_GOOGLE')).toBe('TEAM')
    expect(requiredPlan('SSO_KEYCLOAK')).toBe('ENTERPRISE')
    expect(requiredPlan('SSO_OKTA')).toBe('ENTERPRISE')
    expect(requiredPlan('BANNER')).toBe('TEAM')
    expect(requiredPlan('AUDIT_LOG')).toBe('ENTERPRISE')
  })
})


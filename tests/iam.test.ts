import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getUserPermissions, hasPermission, getAccessibleConnectionIds, getAgentPermissions } from '../server/lib/iam'
import * as config from '../server/lib/config'
import { feature as featureCheck } from '../src/lib/plan'

// Mock config module
vi.mock('../server/lib/config', () => ({
  getIAMRules: vi.fn(),
  getGroupsForUser: vi.fn(),
  isAuthEnabled: vi.fn(),
  getPlan: vi.fn(),
}))

vi.mock('../src/lib/plan', () => ({
  feature: vi.fn(),
}))

describe('getUserPermissions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: IAM feature enabled (existing tests assume this)
    vi.mocked(featureCheck).mockReturnValue(true)
  })

  it('returns all permissions when auth is disabled', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(false)
    vi.mocked(config.getIAMRules).mockReturnValue([])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('anyone', 'any-connection')
    expect(perms).toEqual(new Set(['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']))
  })

  it('returns empty set when no rules match', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set())
  })

  it('matches user: member', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read']))
  })

  it('matches group: member', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read', 'write'], members: ['group:dev-team'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([{ id: 'dev-team', name: 'Dev Team', members: ['alice'] }])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read', 'write']))
  })

  it('matches * member (all users)', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read'], members: ['*'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('anyone', 'prod')
    expect(perms).toEqual(new Set(['read']))
  })

  it('matches wildcard connection', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: '*', permissions: ['read'], members: ['*'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'any-connection')
    expect(perms).toEqual(new Set(['read']))
  })

  it('unions permissions from multiple matching rules', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read'], members: ['group:dev-team'] },
      { connection: 'prod', permissions: ['write'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([{ id: 'dev-team', name: 'Dev Team', members: ['alice'] }])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read', 'write']))
  })

  it('expands allPermissions to all permission types', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']))
  })

  it('combines wildcard and specific connection rules', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: '*', permissions: ['read'], members: ['*'] },
      { connection: 'prod', permissions: ['write'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read', 'write']))
  })

  it('returns all permissions when IAM feature is not enabled by plan', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(featureCheck).mockReturnValue(false)
    vi.mocked(config.getIAMRules).mockReturnValue([])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const perms = getUserPermissions('alice', 'prod')
    expect(perms).toEqual(new Set(['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']))
  })
})

describe('hasPermission', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: IAM feature enabled (existing tests assume this)
    vi.mocked(featureCheck).mockReturnValue(true)
  })

  it('returns true when user has the permission', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read', 'write'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    expect(hasPermission('alice', 'prod', 'read')).toBe(true)
    expect(hasPermission('alice', 'prod', 'write')).toBe(true)
    expect(hasPermission('alice', 'prod', 'ddl')).toBe(false)
  })
})

describe('getAgentPermissions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(featureCheck).mockReturnValue(true)
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getGroupsForUser).mockReturnValue([])
  })

  const pure = (id: string) => ({ id, name: id, token: 't' })

  it('matches agent: members', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read', 'ddl'], members: ['agent:migration-bot'] },
    ])
    expect(getAgentPermissions(pure('migration-bot'), 'prod')).toEqual(new Set(['read', 'ddl']))
  })

  it('does NOT inherit * or group: or user: rules', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['admin'], members: ['*'] },
      { connection: 'prod', permissions: ['write'], members: ['group:dba'] },
      { connection: 'prod', permissions: ['ddl'], members: ['user:bot'] },
    ])
    expect(getAgentPermissions(pure('bot'), 'prod')).toEqual(new Set())
  })

  it('honors wildcard connection rules', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: '*', permissions: ['read'], members: ['agent:bot'] },
    ])
    expect(getAgentPermissions(pure('bot'), 'anything')).toEqual(new Set(['read']))
  })

  it('returns empty when no agent rule matches', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read'], members: ['agent:other'] },
    ])
    expect(getAgentPermissions(pure('bot'), 'prod')).toEqual(new Set())
  })

  it('delegated agent inherits the user grant narrowed by the permission cap', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'prod', permissions: ['read', 'write', 'ddl'], members: ['user:alice'] },
    ])
    const agent = { id: 'alice-bot', name: 'a', token: 't', onBehalfOf: 'alice', permissions: ['read' as const] }
    expect(getAgentPermissions(agent, 'prod')).toEqual(new Set(['read']))
  })

  it('delegated connection cap blocks other connections', () => {
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: '*', permissions: ['read'], members: ['user:alice'] },
    ])
    const agent = { id: 'alice-bot', name: 'a', token: 't', onBehalfOf: 'alice', connections: ['prod'] }
    expect(getAgentPermissions(agent, 'prod')).toEqual(new Set(['read']))
    expect(getAgentPermissions(agent, 'staging')).toEqual(new Set())
  })
})

describe('getAccessibleConnectionIds', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: IAM feature enabled (existing tests assume this)
    vi.mocked(featureCheck).mockReturnValue(true)
  })

  it('returns all connections when auth is disabled', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(false)
    vi.mocked(config.getIAMRules).mockReturnValue([])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const result = getAccessibleConnectionIds('anyone', ['conn1', 'conn2', 'conn3'])
    expect(result).toEqual(['conn1', 'conn2', 'conn3'])
  })

  it('filters to only accessible connections', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([
      { connection: 'conn1', permissions: ['read'], members: ['user:alice'] },
      { connection: 'conn3', permissions: ['read'], members: ['user:alice'] },
    ])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const result = getAccessibleConnectionIds('alice', ['conn1', 'conn2', 'conn3'])
    expect(result).toEqual(['conn1', 'conn3'])
  })

  it('returns empty array when no permissions', () => {
    vi.mocked(config.isAuthEnabled).mockReturnValue(true)
    vi.mocked(config.getIAMRules).mockReturnValue([])
    vi.mocked(config.getGroupsForUser).mockReturnValue([])

    const result = getAccessibleConnectionIds('alice', ['conn1', 'conn2'])
    expect(result).toEqual([])
  })
})

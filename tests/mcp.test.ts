import { describe, it, expect } from 'vitest'
import { loadConfigFromString, getAgents, getAgentById, getAgentByToken } from '../server/lib/config'
import { selectToolNames, Principal, dispatchTool } from '../server/mcp'
import type { Permission } from '../server/lib/config'

const BASE = `
[auth]
jwt_secret = "test-secret-key-at-least-32-characters-long"

[[users]]
email = "alice@example.com"
password = "pw"

[[connections]]
id = "prod"
name = "Prod"
host = "localhost"
port = 5432
database = "postgres"
username = "postgres"
lazy = true

[[connections]]
id = "staging"
name = "Staging"
host = "localhost"
port = 5432
database = "postgres"
username = "postgres"
lazy = true
`

describe('agent config', () => {
  it('parses a pure agent and resolves its token', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "migration-bot"
name = "Nightly Migration Bot"
token = "pgc_pure"
`)
    expect(getAgents()).toHaveLength(1)
    const agent = getAgentByToken('pgc_pure')
    expect(agent?.id).toBe('migration-bot')
    expect(agent?.onBehalfOf).toBeUndefined()
    expect(getAgentById('migration-bot')?.name).toBe('Nightly Migration Bot')
  })

  it('parses a delegated agent with caps', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "alice-claude"
token = "pgc_deleg"
on_behalf_of = "alice@example.com"
permissions = ["read"]
connections = ["prod"]
`)
    const agent = getAgentByToken('pgc_deleg')!
    expect(agent.onBehalfOf).toBe('alice@example.com')
    expect(agent.permissions).toEqual(['read'])
    expect(agent.connections).toEqual(['prod'])
  })

  it('returns undefined for an unknown token', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "bot"
token = "known"
`)
    expect(getAgentByToken('nope')).toBeUndefined()
  })

  it('allows an agent: member in IAM rules', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "bot"
token = "t"

[[iam]]
connection = "staging"
permissions = ["read", "ddl"]
members = ["agent:bot"]
`)
    expect(getAgents()).toHaveLength(1)
  })

  describe('validation', () => {
    const cases: Array<[string, RegExp]> = [
      ['[[agents]]\nid = "x"', /missing required field: token/],
      ['[[agents]]\ntoken = "x"', /missing required field: id/],
      ['[[agents]]\nid = "a"\ntoken = "t1"\n[[agents]]\nid = "b"\ntoken = "t1"', /Duplicate agent token/],
      ['[[agents]]\nid = "a"\ntoken = "t1"\n[[agents]]\nid = "a"\ntoken = "t2"', /Duplicate agent id/],
      ['[[agents]]\nid = "a"\ntoken = "t"\non_behalf_of = "ghost@example.com"', /references unknown user/],
      ['[[agents]]\nid = "a"\ntoken = "t"\npermissions = ["read"]', /requires on_behalf_of/],
      ['[[agents]]\nid = "a"\ntoken = "t"\non_behalf_of = "alice@example.com"\nconnections = ["ghost"]', /references unknown connection/],
      ['[[iam]]\nconnection = "prod"\npermissions = ["read"]\nmembers = ["agent:ghost"]', /references unknown agent/],
    ]
    it.each(cases)('rejects: %s', async (snippet, pattern) => {
      await expect(loadConfigFromString(`${BASE}\n${snippet}`)).rejects.toThrow(pattern)
    })
  })
})

describe('Principal permission resolution', () => {
  // On the FREE plan IAM is not enforced, so getUserPermissions returns the full set —
  // which lets us verify that a delegated agent's caps actually narrow that base.
  it('delegated caps narrow the user grant (permission cap)', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "alice-claude"
token = "t"
on_behalf_of = "alice@example.com"
permissions = ["read", "explain"]
`)
    const p = new Principal(getAgentByToken('t')!)
    expect(p.permissions('prod')).toEqual(new Set<Permission>(['read', 'explain']))
    expect(p.auditActor).toBe('alice@example.com')
  })

  it('delegated connection cap blocks other connections', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "alice-claude"
token = "t"
on_behalf_of = "alice@example.com"
connections = ["prod"]
`)
    const p = new Principal(getAgentByToken('t')!)
    expect(p.permissions('prod').size).toBeGreaterThan(0)
    expect(p.permissions('staging')).toEqual(new Set())
  })

  it('a pure agent audits as agent:<id>', async () => {
    await loadConfigFromString(`${BASE}
[[agents]]
id = "bot"
token = "t"
`)
    expect(new Principal(getAgentByToken('t')!).auditActor).toBe('agent:bot')
  })
})

describe('dispatchTool enforcement', () => {
  // These exercise the permission/per-statement gating, which throws before any DB I/O.
  // On the FREE plan a pure agent has all permissions, so rejections come purely from the
  // tool's statement-kind rule; a delegated read-only agent exercises the cap-based denials.
  const AGENTS = `
[[agents]]
id = "pure"
token = "tok-pure"

[[agents]]
id = "ro"
token = "tok-ro"
on_behalf_of = "alice@example.com"
permissions = ["read"]

[[agents]]
id = "ro-prod"
token = "tok-roprod"
on_behalf_of = "alice@example.com"
connections = ["prod"]
`
  const principal = async (token: string) => {
    await loadConfigFromString(`${BASE}\n${AGENTS}`)
    return new Principal(getAgentByToken(token)!)
  }
  const call = (p: Principal, name: string, args: Record<string, unknown>) => dispatchTool(p, name, args)

  it('query rejects a DROP (kind mismatch)', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'query', { connection: 'prod', sql: 'DROP TABLE x' })).rejects.toThrow(/only accepts statements requiring 'read'/)
  })

  it('query rejects a mixed-class batch', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'query', { connection: 'prod', sql: 'SELECT 1; DROP TABLE x' })).rejects.toThrow(/requires 'ddl'/)
  })

  it('write_data rejects a SELECT', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'write_data', { connection: 'prod', sql: 'SELECT 1' })).rejects.toThrow(/only accepts statements requiring 'write'/)
  })

  it('function-derived admin is required (read token denied pg_terminate_backend)', async () => {
    const p = await principal('tok-ro')
    await expect(call(p, 'query', { connection: 'prod', sql: 'SELECT pg_terminate_backend(1)' })).rejects.toThrow(/requires 'admin'/)
  })

  it('explain_query rejects a non-read statement', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'explain_query', { connection: 'prod', sql: 'UPDATE x SET a = 1' })).rejects.toThrow(/single SELECT or SHOW/)
  })

  it('explain_query rejects multiple statements', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'explain_query', { connection: 'prod', sql: 'SELECT 1; SELECT 2' })).rejects.toThrow(/single SELECT or SHOW/)
  })

  it('fails closed on an inaccessible connection (no existence leak)', async () => {
    const p = await principal('tok-roprod') // capped to prod
    await expect(call(p, 'query', { connection: 'staging', sql: 'SELECT 1' })).rejects.toThrow(/not found or not accessible/)
  })

  it('rejects an unknown tool', async () => {
    const p = await principal('tok-pure')
    await expect(call(p, 'frobnicate', {})).rejects.toThrow(/Unknown tool/)
  })
})

describe('selectToolNames', () => {
  const perms = (...p: Permission[]) => new Set<Permission>(p)

  it('always exposes list_connections', () => {
    expect(selectToolNames(false, perms())).toEqual(['list_connections'])
  })

  it('exposes discovery tools when a connection is accessible', () => {
    expect(selectToolNames(true, perms())).toEqual(['list_connections', 'list_objects', 'describe_table'])
  })

  it('a read-only agent sees query/explain but not write/ddl', () => {
    const names = selectToolNames(true, perms('read', 'explain'))
    expect(names).toContain('query')
    expect(names).toContain('explain_query')
    expect(names).not.toContain('write_data')
    expect(names).not.toContain('run_ddl')
  })

  it('a write agent additionally sees write_data', () => {
    expect(selectToolNames(true, perms('read', 'write'))).toContain('write_data')
  })

  it('a ddl agent sees run_ddl', () => {
    expect(selectToolNames(true, perms('ddl'))).toContain('run_ddl')
  })
})

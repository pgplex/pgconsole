import { describe, it, expect } from 'vitest'
import { loadConfigFromString, getMcpTokens, resolveMcpTokenEmail } from '../server/lib/config'
import { selectToolNames } from '../server/mcp'
import type { Permission } from '../server/lib/config'

const BASE = `
[auth]
jwt_secret = "test-secret-key-at-least-32-characters-long"

[[users]]
email = "agent@example.com"
password = "pw"
`

describe('MCP token config', () => {
  it('parses [[mcp.tokens]] and resolves a token to its email', async () => {
    await loadConfigFromString(`${BASE}
[[mcp.tokens]]
token = "pgc_secret_token"
email = "agent@example.com"
`)
    expect(getMcpTokens()).toHaveLength(1)
    expect(resolveMcpTokenEmail('pgc_secret_token')).toBe('agent@example.com')
  })

  it('returns undefined for an unknown token', async () => {
    await loadConfigFromString(`${BASE}
[[mcp.tokens]]
token = "known"
email = "agent@example.com"
`)
    expect(resolveMcpTokenEmail('not-a-token')).toBeUndefined()
  })

  it('has no tokens when [mcp] is absent', async () => {
    await loadConfigFromString(BASE)
    expect(getMcpTokens()).toEqual([])
    expect(resolveMcpTokenEmail('anything')).toBeUndefined()
  })

  it('rejects a token entry missing email', async () => {
    await expect(
      loadConfigFromString(`${BASE}
[[mcp.tokens]]
token = "only-token"
`)
    ).rejects.toThrow(/missing required field: email/)
  })

  it('rejects an invalid email', async () => {
    await expect(
      loadConfigFromString(`${BASE}
[[mcp.tokens]]
token = "t"
email = "not-an-email"
`)
    ).rejects.toThrow(/invalid email/)
  })

  it('rejects duplicate tokens', async () => {
    await expect(
      loadConfigFromString(`${BASE}
[[mcp.tokens]]
token = "dup"
email = "agent@example.com"

[[mcp.tokens]]
token = "dup"
email = "agent@example.com"
`)
    ).rejects.toThrow(/Duplicate MCP token/)
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

  it('a read-only token sees the read execution tool but not write/ddl', () => {
    const names = selectToolNames(true, perms('read', 'explain'))
    expect(names).toContain('query')
    expect(names).toContain('explain_query')
    expect(names).not.toContain('write_data')
    expect(names).not.toContain('run_ddl')
  })

  it('a write token additionally sees write_data', () => {
    const names = selectToolNames(true, perms('read', 'write'))
    expect(names).toContain('query')
    expect(names).toContain('write_data')
    expect(names).not.toContain('run_ddl')
  })

  it('a ddl token sees run_ddl', () => {
    expect(selectToolNames(true, perms('ddl'))).toContain('run_ddl')
  })
})

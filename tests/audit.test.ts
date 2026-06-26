import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadConfigFromString, getAuditRetentionDays } from '../server/lib/config'
import { auditSQL, auditExport, auditLogin, auditLogout, clearAuditEventsForTest, listAuditEvents, listSystemAuditEvents } from '../server/lib/audit'

const BASE = `
[[connections]]
id = "prod"
name = "Prod"
host = "localhost"
port = 5432
database = "postgres"
username = "postgres"
lazy = true
`

describe('audit config', () => {
  it('defaults to indefinite retention', async () => {
    await loadConfigFromString(BASE)
    expect(getAuditRetentionDays()).toBeUndefined()
  })

  it('parses retention days', async () => {
    await loadConfigFromString(`${BASE}
[general.audit]
retention_days = 30
`)
    expect(getAuditRetentionDays()).toBe(30)
  })

  it.each(['0', '-1', '1.5', '"30"'])('rejects invalid retention_days = %s', async (value) => {
    await expect(loadConfigFromString(`${BASE}
[general.audit]
retention_days = ${value}
`)).rejects.toThrow(/general\.audit\.retention_days must be a positive integer/)
  })
})

describe('audit event store', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    clearAuditEventsForTest()
    await loadConfigFromString(BASE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns connection-scoped entries newest-first', () => {
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT 1', true, 3, 1)
    auditSQL('alice@example.com', 'other', 'postgres', 'SELECT 2', true, 4, 1)
    auditExport('alice@example.com', 'prod', 'postgres', 'SELECT 1', 1, 'csv')

    const entries = listAuditEvents('prod', 10)
    expect(entries).toHaveLength(2)
    expect(entries[0].action).toBe('data.export')
    expect('source' in entries[0] ? entries[0].source : '').toBe('web')
    expect(entries[1].action).toBe('sql.execute')
    expect('source' in entries[1] ? entries[1].source : '').toBe('web')
  })

  it('records source for web and MCP SQL events', () => {
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT 1', true, 1, 1)
    auditSQL('agent:bot', 'prod', 'postgres', 'SELECT 2', true, 1, 1, undefined, {
      source: 'mcp',
      tool: 'query',
      agent: 'bot',
    })

    const entries = listAuditEvents('prod', 10)
    expect(entries).toHaveLength(2)
    expect('source' in entries[0] ? entries[0].source : '').toBe('mcp')
    expect('tool' in entries[0] ? entries[0].tool : '').toBe('query')
    expect('agent' in entries[0] ? entries[0].agent : '').toBe('bot')
    expect('source' in entries[1] ? entries[1].source : '').toBe('web')
  })

  it('records source for system auth events', () => {
    auditLogin('alice@example.com', 'password', '10.0.0.1', true)
    auditLogout('alice@example.com')

    const system = listSystemAuditEvents(10)
    expect(system).toHaveLength(2)
    expect(system.every((event) => 'source' in event && event.source === 'web')).toBe(true)
  })

  it('applies the response limit', () => {
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT 1', true, 1, 1)
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT 2', true, 1, 1)

    const entries = listAuditEvents('prod', 1)
    expect(entries).toHaveLength(1)
    expect('sql' in entries[0] ? entries[0].sql : '').toBe('SELECT 2')
  })

  it('separates system (auth) events from connection-scoped events', () => {
    auditLogin('alice@example.com', 'password', '10.0.0.1', true)
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT 1', true, 1, 1)
    auditLogout('alice@example.com')

    // System tab: only the non-connection auth events, newest-first.
    const system = listSystemAuditEvents(10)
    expect(system.map((e) => e.action)).toEqual(['auth.logout', 'auth.login'])

    // Connection tab is unaffected — still only connection-scoped events.
    const conn = listAuditEvents('prod', 10)
    expect(conn).toHaveLength(1)
    expect(conn[0].action).toBe('sql.execute')
  })

  it('applies the response limit to system events', () => {
    auditLogin('alice@example.com', 'password', '10.0.0.1', true)
    auditLogin('bob@example.com', 'password', '10.0.0.2', false, 'bad password')

    const system = listSystemAuditEvents(1)
    expect(system).toHaveLength(1)
    expect(system[0].actor).toBe('bob@example.com')
  })

  it('prunes events older than retention_days on insert', async () => {
    await loadConfigFromString(`${BASE}
[general.audit]
retention_days = 1
`)
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT old', true, 1, 1)

    vi.setSystemTime(new Date('2026-01-02T00:00:01.000Z'))
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT new', true, 1, 1)

    const entries = listAuditEvents('prod', 10)
    expect(entries).toHaveLength(1)
    expect('sql' in entries[0] ? entries[0].sql : '').toBe('SELECT new')
  })

  it('prunes expired events even if timestamps are out of order', async () => {
    await loadConfigFromString(`${BASE}
[general.audit]
retention_days = 1
`)
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z'))
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT keep', true, 1, 1)

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    auditSQL('alice@example.com', 'prod', 'postgres', 'SELECT prune', true, 1, 1)

    vi.setSystemTime(new Date('2026-01-03T00:00:01.000Z'))
    const entries = listAuditEvents('prod', 10)
    expect(entries).toHaveLength(1)
    expect('sql' in entries[0] ? entries[0].sql : '').toBe('SELECT keep')
  })
})

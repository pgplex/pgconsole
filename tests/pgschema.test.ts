import { describe, it, expect } from 'vitest'
import { parsePlanJson } from '../server/lib/pgschema'

describe('parsePlanJson', () => {
  it('parses a plan with diffs', () => {
    const json = {
      version: '1.0.0',
      pgschema_version: '1.0.0',
      created_at: '2025-08-13T10:30:15+08:00',
      source_fingerprint: { hash: 'abc123' },
      diffs: [
        {
          sql: 'ALTER TABLE users ADD COLUMN name varchar(100);',
          type: 'table',
          operation: 'alter',
          path: 'public.users',
          can_run_in_transaction: true,
        },
        {
          sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
          type: 'index',
          operation: 'create',
          path: 'public.idx_users_email',
          can_run_in_transaction: false,
        },
      ],
    }

    const result = parsePlanJson(json)
    expect(result.sourceFingerprint).toBe('abc123')
    expect(result.diffs).toHaveLength(2)
    expect(result.diffs[0]).toEqual({
      sql: 'ALTER TABLE users ADD COLUMN name varchar(100);',
      type: 'table',
      operation: 'alter',
      path: 'public.users',
      canRunInTransaction: true,
    })
    expect(result.canRunInTransaction).toBe(false)
    expect(result.summary).toBe('2 changes: 1 to create, 1 to alter')
  })

  it('parses an empty plan', () => {
    const json = {
      version: '1.0.0',
      pgschema_version: '1.0.0',
      created_at: '2025-08-13T10:30:15+08:00',
      source_fingerprint: { hash: 'abc123' },
      diffs: [],
    }

    const result = parsePlanJson(json)
    expect(result.diffs).toHaveLength(0)
    expect(result.canRunInTransaction).toBe(true)
    expect(result.summary).toBe('No changes')
  })

  it('generates correct summary with all operation types', () => {
    const json = {
      version: '1.0.0',
      pgschema_version: '1.0.0',
      created_at: '2025-08-13T10:30:15+08:00',
      source_fingerprint: { hash: 'abc123' },
      diffs: [
        { sql: 'CREATE TABLE a ();', type: 'table', operation: 'create', path: 'public.a', can_run_in_transaction: true },
        { sql: 'CREATE TABLE b ();', type: 'table', operation: 'create', path: 'public.b', can_run_in_transaction: true },
        { sql: 'ALTER TABLE c ADD COLUMN x int;', type: 'table', operation: 'alter', path: 'public.c', can_run_in_transaction: true },
        { sql: 'DROP TABLE d;', type: 'table', operation: 'drop', path: 'public.d', can_run_in_transaction: true },
      ],
    }

    const result = parsePlanJson(json)
    expect(result.summary).toBe('4 changes: 2 to create, 1 to alter, 1 to drop')
  })
})

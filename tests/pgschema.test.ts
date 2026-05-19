import { describe, it, expect } from 'vitest'
import { parsePlanJson } from '../server/lib/pgschema'

describe('parsePlanJson', () => {
  it('parses a plan with diffs', () => {
    const json = {
      schemas: {
        public: {
          source_fingerprint: { hash: 'abc123' },
          groups: [
            {
              can_run_in_transaction: true,
              steps: [
                {
                  sql: 'ALTER TABLE users ADD COLUMN name varchar(100);',
                  type: 'table',
                  operation: 'alter',
                  path: 'public.users',
                },
              ],
            },
            {
              can_run_in_transaction: false,
              steps: [
                {
                  sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
                  type: 'index',
                  operation: 'create',
                  path: 'public.idx_users_email',
                },
              ],
            },
          ],
        },
      },
    }

    const result = parsePlanJson(json, 'public')
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
      schemas: {
        public: {
          source_fingerprint: { hash: 'abc123' },
          groups: [],
        },
      },
    }

    const result = parsePlanJson(json, 'public')
    expect(result.diffs).toHaveLength(0)
    expect(result.canRunInTransaction).toBe(true)
    expect(result.summary).toBe('No changes')
  })

  it('generates correct summary with all operation types', () => {
    const json = {
      schemas: {
        public: {
          source_fingerprint: { hash: 'abc123' },
          groups: [
            {
              can_run_in_transaction: true,
              steps: [
                { sql: 'CREATE TABLE a ();', type: 'table', operation: 'create', path: 'public.a' },
                { sql: 'CREATE TABLE b ();', type: 'table', operation: 'create', path: 'public.b' },
                { sql: 'ALTER TABLE c ADD COLUMN x int;', type: 'table', operation: 'alter', path: 'public.c' },
                { sql: 'DROP TABLE d;', type: 'table', operation: 'drop', path: 'public.d' },
              ],
            },
          ],
        },
      },
    }

    const result = parsePlanJson(json, 'public')
    expect(result.summary).toBe('4 changes: 2 to create, 1 to alter, 1 to drop')
  })
})

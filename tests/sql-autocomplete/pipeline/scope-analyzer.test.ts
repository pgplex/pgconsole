// tests/sql-autocomplete/pipeline/scope-analyzer.test.ts

import { describe, it, expect, beforeAll } from 'vitest'
import { analyzeScope, resolveAlias, getColumnsForTable } from '../../../src/lib/sql/autocomplete/scope-analyzer'
import { detectSection } from '../../../src/lib/sql/autocomplete/section-detector'
import { tokenize } from '../../../src/lib/sql/autocomplete/tokenizer'
import { parseFromTokens } from '../../../src/lib/sql/autocomplete/parser'
import { ensureModuleLoaded } from '../../../src/lib/sql/core'
import type { SchemaInfo } from '../../../src/lib/sql/autocomplete/types'

// ============================================================================
// TEST HELPERS
// ============================================================================

const mockSchema: SchemaInfo = {
  defaultSchema: 'public',
  tables: [
    {
      schema: 'public',
      name: 'users',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false },
        { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      schema: 'public',
      name: 'orders',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true },
        { name: 'total', type: 'decimal', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      schema: 'auth',
      name: 'sessions',
      type: 'table',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true },
      ],
    },
  ],
  functions: [],
}

// | marks cursor position
function getScope(sqlWithCursor: string, schema: SchemaInfo = mockSchema) {
  const cursorPos = sqlWithCursor.indexOf('|')
  const sql = sqlWithCursor.replace('|', '')
  const tokenized = tokenize(sql, cursorPos)
  const tree = parseFromTokens(tokenized, sql)
  const context = detectSection(tokenized, tree, cursorPos, sql)
  return analyzeScope(context, tokenized, tree, sql, schema)
}

// ============================================================================
// TEST CASE TYPES
// ============================================================================

interface TableExtractionTestCase {
  name: string
  sql: string
  expectedTable: { name: string; alias?: string; schema?: string; source?: string }
}

interface CTETestCase {
  name: string
  sql: string
  expectedCTEs: { name: string; columns?: string[] }[]
}

interface ColumnResolutionTestCase {
  name: string
  sql: string
  expectedColumns: { name: string; table?: string }[]
}

interface AliasTestCase {
  name: string
  sql: string
  alias: string
  expectedTable: string | null
}

interface GetColumnsTestCase {
  name: string
  sql: string
  tableOrAlias: string
  expectedColumns: string[]
}

// ============================================================================
// TEST DATA
// ============================================================================

const tableExtractionTests: TableExtractionTestCase[] = [
  { name: 'FROM clause', sql: 'SELECT * FROM users WHERE |', expectedTable: { name: 'users', source: 'from' } },
  { name: 'table with alias', sql: 'SELECT * FROM users u WHERE |', expectedTable: { name: 'users', alias: 'u', source: 'from' } },
  { name: 'table with AS alias', sql: 'SELECT * FROM users AS u WHERE |', expectedTable: { name: 'users', alias: 'u', source: 'from' } },
  { name: 'joined table', sql: 'SELECT * FROM users JOIN orders ON |', expectedTable: { name: 'orders', source: 'join' } },
  { name: 'joined table with alias', sql: 'SELECT * FROM users u JOIN orders o ON |', expectedTable: { name: 'orders', alias: 'o', source: 'join' } },
  { name: 'schema-qualified table', sql: 'SELECT * FROM auth.sessions WHERE |', expectedTable: { name: 'sessions', schema: 'auth' } },
]

const cteTests: CTETestCase[] = [
  { name: 'single CTE', sql: 'WITH active_users AS (SELECT * FROM users) SELECT * FROM |', expectedCTEs: [{ name: 'active_users' }] },
  { name: 'multiple CTEs', sql: 'WITH cte1 AS (SELECT 1), cte2 AS (SELECT 2) SELECT |', expectedCTEs: [{ name: 'cte1' }, { name: 'cte2' }] },
  { name: 'CTE with explicit columns', sql: 'WITH cte(a, b) AS (SELECT 1, 2) SELECT |', expectedCTEs: [{ name: 'cte', columns: ['a', 'b'] }] },
]

const columnResolutionTests: ColumnResolutionTestCase[] = [
  { name: 'columns from single table', sql: 'SELECT | FROM users', expectedColumns: [{ name: 'id', table: 'users' }, { name: 'name', table: 'users' }, { name: 'email', table: 'users' }] },
  { name: 'columns from aliased table', sql: 'SELECT | FROM users u', expectedColumns: [{ name: 'id', table: 'u' }] },
]

const aliasTests: AliasTestCase[] = [
  { name: 'resolves alias', sql: 'SELECT * FROM users u WHERE |', alias: 'u', expectedTable: 'users' },
  { name: 'null for unknown alias', sql: 'SELECT * FROM users WHERE |', alias: 'x', expectedTable: null },
  { name: 'case-insensitive', sql: 'SELECT * FROM users U WHERE |', alias: 'u', expectedTable: 'users' },
]

const getColumnsTests: GetColumnsTestCase[] = [
  { name: 'by table name', sql: 'SELECT | FROM users', tableOrAlias: 'users', expectedColumns: ['id', 'name', 'email'] },
  { name: 'by alias', sql: 'SELECT | FROM users u', tableOrAlias: 'u', expectedColumns: ['id', 'name', 'email'] },
  { name: 'empty for unknown', sql: 'SELECT | FROM users', tableOrAlias: 'nonexistent', expectedColumns: [] },
]

// ============================================================================
// TEST RUNNER
// ============================================================================

describe('scope-analyzer', () => {
  beforeAll(async () => {
    await ensureModuleLoaded()
  })

  describe('table extraction', () => {
    for (const tc of tableExtractionTests) {
      it(tc.name, () => {
        const scope = getScope(tc.sql)
        expect(scope.availableTables).toContainEqual(expect.objectContaining(tc.expectedTable))
      })
    }

    it('extracts multiple joined tables', () => {
      const scope = getScope('SELECT * FROM users JOIN orders ON |')
      expect(scope.availableTables).toHaveLength(2)
    })
  })

  describe('CTE extraction', () => {
    for (const tc of cteTests) {
      it(tc.name, () => {
        const scope = getScope(tc.sql)
        expect(scope.ctes).toHaveLength(tc.expectedCTEs.length)
        for (const expected of tc.expectedCTEs) {
          expect(scope.ctes).toContainEqual(expect.objectContaining(expected))
        }
      })
    }

    it('adds CTEs as virtual tables', () => {
      const scope = getScope('WITH active_users AS (SELECT * FROM users) SELECT * FROM |')
      expect(scope.availableTables).toContainEqual(expect.objectContaining({ name: 'active_users', source: 'cte' }))
    })
  })

  describe('column resolution', () => {
    for (const tc of columnResolutionTests) {
      it(tc.name, () => {
        const scope = getScope(tc.sql)
        for (const expected of tc.expectedColumns) {
          expect(scope.availableColumns).toContainEqual(expect.objectContaining(expected))
        }
      })
    }

    it('resolves columns for multiple tables', () => {
      const scope = getScope('SELECT | FROM users u JOIN orders o ON u.id = o.user_id')
      const columnNames = scope.availableColumns.map((c) => `${c.table}.${c.name}`)
      expect(columnNames).toContain('u.id')
      expect(columnNames).toContain('o.id')
    })

    it('resolves columns for schema-qualified table', () => {
      const scope = getScope('SELECT | FROM auth.sessions')
      expect(scope.availableColumns).toContainEqual(expect.objectContaining({ name: 'id', type: 'uuid' }))
    })
  })

  describe('resolveAlias', () => {
    for (const tc of aliasTests) {
      it(tc.name, () => {
        const scope = getScope(tc.sql)
        expect(resolveAlias(scope, tc.alias)).toBe(tc.expectedTable)
      })
    }
  })

  describe('getColumnsForTable', () => {
    for (const tc of getColumnsTests) {
      it(tc.name, () => {
        const scope = getScope(tc.sql)
        const columns = getColumnsForTable(scope, tc.tableOrAlias)
        expect(columns.map((c) => c.name)).toEqual(tc.expectedColumns)
      })
    }
  })

  describe('pg_query integration', () => {
    it('sets isPgQueryValid for valid SQL', () => {
      const scope = getScope('SELECT * FROM users WHERE |')
      expect(typeof scope.isPgQueryValid).toBe('boolean')
    })

    it('handles incomplete SQL gracefully', () => {
      const scope = getScope('SELECT * FROM users WHERE id = |')
      expect(scope.availableTables).toContainEqual(expect.objectContaining({ name: 'users' }))
    })
  })
})

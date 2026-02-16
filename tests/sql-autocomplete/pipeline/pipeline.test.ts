// tests/sql-autocomplete/pipeline/pipeline.test.ts

import { describe, it, expect, beforeAll } from 'vitest'
import { autocomplete, runAutocompletePipeline } from '../../../src/lib/sql/autocomplete/pipeline'
import { ensureModuleLoaded } from '../../../src/lib/sql/core'
import type { SchemaInfo, CandidateType, SQLSection, StatementType } from '../../../src/lib/sql/autocomplete/types'

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
        { name: 'username', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'created_at', type: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
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
        { name: 'status', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      schema: 'public',
      name: 'user_profiles',
      type: 'view',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'full_name', type: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      schema: 'auth',
      name: 'sessions',
      type: 'table',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'token', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
  ],
  functions: [
    { schema: 'public', name: 'my_function', signature: 'x integer', returnType: 'integer', kind: 'function' },
    { schema: 'public', name: 'refresh_data', signature: '', returnType: '', kind: 'procedure' },
    { schema: 'public', name: 'cleanup_old_records', signature: 'days integer', returnType: '', kind: 'procedure' },
  ],
}

// | marks cursor position
function complete(sqlWithCursor: string, schema: SchemaInfo = mockSchema) {
  const cursorPos = sqlWithCursor.indexOf('|')
  const sql = sqlWithCursor.replace('|', '')
  return autocomplete(sql, cursorPos, schema)
}

// ============================================================================
// TEST CASE TYPES
// ============================================================================

interface SuggestionTestCase {
  name: string
  sql: string // | marks cursor
  filterTypes?: CandidateType[] // types to filter suggestions by
  shouldContain?: string[] // expected values in suggestions
  shouldNotContain?: string[] // values that should NOT be in suggestions
  minCount?: number // minimum number of filtered suggestions
}

interface ContextTestCase {
  name: string
  sql: string
  expectedSection?: SQLSection
  expectedStatementType?: StatementType
}

interface RankingTestCase {
  name: string
  sql: string
  expectedFirstType: CandidateType | CandidateType[] // type(s) that should be first
  expectedFirstValue?: string // specific value that should be first
}

interface NoSuggestionTestCase {
  name: string
  sql: string
}

// ============================================================================
// TEST DATA
// ============================================================================

const statementStartTests: SuggestionTestCase[] = [
  {
    name: 'suggests statement keywords at empty input',
    sql: '|',
    filterTypes: ['keyword'],
    shouldContain: ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CALL'],
  },
  {
    name: 'suggests statement keywords after semicolon',
    sql: 'SELECT 1; |',
    filterTypes: ['keyword'],
    shouldContain: ['SELECT'],
  },
]

const selectClauseTests: SuggestionTestCase[] = [
  {
    name: 'suggests columns after SELECT',
    sql: 'SELECT | FROM users',
    filterTypes: ['column'],
    shouldContain: ['id', 'username'],
  },
  {
    name: 'suggests functions after SELECT',
    sql: 'SELECT | FROM users',
    filterTypes: ['function'],
    shouldContain: ['my_function'],
    shouldNotContain: ['refresh_data', 'cleanup_old_records'], // Procedures should NOT appear
  },
  {
    name: 'suggests columns after comma in SELECT',
    sql: 'SELECT id, | FROM users',
    filterTypes: ['column'],
    shouldContain: ['username'],
  },
  {
    name: 'suggests clause keywords after completed column with space',
    sql: 'SELECT col_bigint |',
    filterTypes: ['keyword'],
    shouldContain: ['FROM', 'WHERE', 'ORDER BY'],
  },
]

const fromClauseTests: SuggestionTestCase[] = [
  {
    name: 'suggests tables after FROM',
    sql: 'SELECT * FROM |',
    filterTypes: ['table', 'view'],
    shouldContain: ['users', 'orders'],
  },
  {
    name: 'suggests views after FROM',
    sql: 'SELECT * FROM |',
    filterTypes: ['view'],
    shouldContain: ['user_profiles'],
  },
  {
    name: 'includes schema-qualified tables',
    sql: 'SELECT * FROM |',
    filterTypes: ['table'],
    shouldContain: ['auth.sessions'],
  },
  {
    name: 'suggests clause keywords after completed table with space',
    sql: 'SELECT * FROM users |',
    filterTypes: ['keyword'],
    shouldContain: ['WHERE', 'ORDER BY', 'GROUP BY'],
  },
]

const joinClauseTests: SuggestionTestCase[] = [
  {
    name: 'suggests tables after JOIN',
    sql: 'SELECT * FROM users JOIN |',
    filterTypes: ['table'],
    shouldContain: ['orders'],
  },
  {
    name: 'suggests tables after LEFT JOIN',
    sql: 'SELECT * FROM users LEFT JOIN |',
    filterTypes: ['table'],
    shouldContain: ['orders'],
  },
]

const tableDotColumnTests: SuggestionTestCase[] = [
  {
    name: 'suggests columns after table dot',
    sql: 'SELECT users.| FROM users',
    filterTypes: ['column'],
    shouldContain: ['id', 'username'],
    shouldNotContain: ['total'], // from orders table
  },
  {
    name: 'suggests columns after alias dot',
    sql: 'SELECT u.| FROM users u',
    filterTypes: ['column'],
    shouldContain: ['id', 'username'],
  },
  {
    name: 'suggests columns from correct table with multiple aliases',
    sql: 'SELECT o.| FROM users u JOIN orders o ON u.id = o.user_id',
    filterTypes: ['column'],
    shouldContain: ['total', 'status'],
    shouldNotContain: ['username'],
  },
]

const whereClauseTests: SuggestionTestCase[] = [
  {
    name: 'suggests columns after WHERE',
    sql: 'SELECT * FROM users WHERE |',
    filterTypes: ['column'],
    shouldContain: ['id'],
  },
  {
    name: 'suggests columns after AND',
    sql: 'SELECT * FROM users WHERE id = 1 AND |',
    filterTypes: ['column'],
    shouldContain: ['username'],
  },
]

const orderGroupByTests: SuggestionTestCase[] = [
  {
    name: 'suggests columns after ORDER BY',
    sql: 'SELECT * FROM users ORDER BY |',
    filterTypes: ['column'],
    shouldContain: ['id', 'created_at'],
  },
  {
    name: 'suggests columns after GROUP BY',
    sql: 'SELECT * FROM users GROUP BY |',
    filterTypes: ['column'],
    shouldContain: ['id'],
  },
  {
    name: 'suggests ASC when typing AS after ORDER BY column',
    sql: 'SELECT * FROM users ORDER BY id AS|',
    filterTypes: ['keyword'],
    shouldContain: ['ASC'], // ASC matches prefix "AS"
  },
  {
    name: 'does not suggest columns after ORDER BY column with space',
    sql: 'SELECT * FROM users ORDER BY id |',
    filterTypes: ['column'],
    shouldNotContain: ['id', 'username'], // should only suggest modifiers, not columns
  },
  {
    name: 'does not suggest columns when typing AS for ASC in ORDER BY',
    sql: 'SELECT * FROM users ORDER BY id AS|',
    filterTypes: ['column'],
    shouldNotContain: ['id', 'username', 'email', 'created_at'],
  },
  {
    name: 'suggests BY after ORDER keyword',
    sql: 'SELECT * FROM users ORDER |',
    filterTypes: ['keyword'],
    shouldContain: ['BY'],
  },
  {
    name: 'suggests BY after GROUP keyword',
    sql: 'SELECT * FROM users GROUP |',
    filterTypes: ['keyword'],
    shouldContain: ['BY'],
  },
]

const cteTests: SuggestionTestCase[] = [
  {
    name: 'suggests CTE as table in FROM',
    sql: 'WITH active_users AS (SELECT * FROM users) SELECT * FROM |',
    filterTypes: ['cte'],
    shouldContain: ['active_users'],
  },
]

const callTests: SuggestionTestCase[] = [
  {
    name: 'suggests procedures after CALL',
    sql: 'CALL |',
    filterTypes: ['procedure'],
    shouldContain: ['refresh_data', 'cleanup_old_records'],
    shouldNotContain: ['my_function'], // Functions should NOT appear, only procedures
  },
  {
    name: 'filters procedures by partial input after CALL',
    sql: 'CALL ref|',
    filterTypes: ['procedure'],
    shouldContain: ['refresh_data'],
    shouldNotContain: ['cleanup_old_records'],
  },
]

const insertTests: SuggestionTestCase[] = [
  {
    name: 'suggests VALUES/SELECT after INSERT INTO table (columns)',
    sql: 'INSERT INTO users (id, username) |',
    filterTypes: ['keyword'],
    shouldContain: ['VALUES', 'SELECT', 'OVERRIDING USER VALUE', 'OVERRIDING SYSTEM VALUE'],
  },
  {
    name: 'filters by partial input after INSERT INTO table (columns)',
    sql: 'INSERT INTO users (id) V|',
    filterTypes: ['keyword'],
    shouldContain: ['VALUES'],
  },
  {
    name: 'suggests tables after INSERT INTO',
    sql: 'INSERT INTO |',
    filterTypes: ['table'],
    shouldContain: ['users', 'orders'],
  },
]

const updateTests: SuggestionTestCase[] = [
  {
    name: 'suggests tables after UPDATE',
    sql: 'UPDATE |',
    filterTypes: ['table'],
    shouldContain: ['users', 'orders'],
  },
  {
    name: 'suggests SET after UPDATE table',
    sql: 'UPDATE users |',
    filterTypes: ['keyword'],
    shouldContain: ['SET'],
  },
  {
    name: 'suggests columns after UPDATE table SET',
    sql: 'UPDATE users SET |',
    filterTypes: ['column'],
    shouldContain: ['id', 'username', 'email'],
  },
  {
    name: 'suggests clause transitions after completed SET assignment',
    sql: "UPDATE users SET name = 'foo' |",
    filterTypes: ['keyword'],
    shouldContain: ['WHERE', 'FROM', 'RETURNING'],
  },
  {
    name: 'suggests columns after UPDATE ... WHERE',
    sql: "UPDATE users SET name = 'foo' WHERE |",
    filterTypes: ['column'],
    shouldContain: ['id', 'username'],
  },
  {
    name: 'suggests RETURNING after completed WHERE condition in UPDATE',
    sql: "UPDATE users SET name = 'foo' WHERE id = 1 |",
    filterTypes: ['keyword'],
    shouldContain: ['AND', 'OR', 'RETURNING'],
  },
  {
    name: 'suggests tables after UPDATE ... FROM',
    sql: "UPDATE users SET name = 'foo' FROM |",
    filterTypes: ['table'],
    shouldContain: ['orders'],
  },
  {
    name: 'suggests columns after UPDATE ... RETURNING',
    sql: "UPDATE users SET name = 'foo' RETURNING |",
    filterTypes: ['column'],
    shouldContain: ['id', 'username', 'email'],
  },
  {
    name: 'suggests functions after UPDATE ... RETURNING',
    sql: "UPDATE users SET name = 'foo' RETURNING |",
    filterTypes: ['function'],
    shouldContain: ['my_function'],
  },
]

const deleteTests: SuggestionTestCase[] = [
  {
    name: 'suggests tables after DELETE FROM',
    sql: 'DELETE FROM |',
    filterTypes: ['table'],
    shouldContain: ['users', 'orders'],
  },
  {
    name: 'suggests clause transitions after DELETE FROM table',
    sql: 'DELETE FROM users |',
    filterTypes: ['keyword'],
    shouldContain: ['USING', 'WHERE', 'RETURNING'],
  },
  {
    name: 'suggests tables after DELETE FROM table USING',
    sql: 'DELETE FROM users USING |',
    filterTypes: ['table'],
    shouldContain: ['orders'],
  },
  {
    name: 'suggests columns after DELETE FROM ... WHERE',
    sql: 'DELETE FROM users WHERE |',
    filterTypes: ['column'],
    shouldContain: ['id', 'username'],
  },
  {
    name: 'suggests RETURNING after completed WHERE condition in DELETE',
    sql: 'DELETE FROM users WHERE id = 1 |',
    filterTypes: ['keyword'],
    shouldContain: ['AND', 'OR', 'RETURNING'],
  },
  {
    name: 'suggests columns after DELETE FROM ... RETURNING',
    sql: 'DELETE FROM users RETURNING |',
    filterTypes: ['column'],
    shouldContain: ['id', 'username', 'email'],
  },
]

const createTableTests: SuggestionTestCase[] = [
  {
    name: 'suggests object types after CREATE',
    sql: 'CREATE |',
    filterTypes: ['keyword'],
    shouldContain: ['TABLE', 'INDEX', 'VIEW', 'FUNCTION', 'SCHEMA', 'EXTENSION'],
  },
  {
    name: 'ranks TABLE first after CREATE',
    sql: 'CREATE |',
    filterTypes: ['keyword'],
    shouldContain: ['TABLE'],
  },
  {
    name: 'suggests TABLE after CREATE TEMP',
    sql: 'CREATE TEMP |',
    filterTypes: ['keyword'],
    shouldContain: ['TABLE'],
  },
  {
    name: 'filters object types by partial input',
    sql: 'CREATE TAB|',
    filterTypes: ['keyword'],
    shouldContain: ['TABLE'],
    shouldNotContain: ['INDEX', 'VIEW', 'FUNCTION'],
  },
  {
    name: 'no suggestions for table name after CREATE TABLE',
    sql: 'CREATE TABLE |',
    filterTypes: ['keyword'],
    shouldNotContain: ['SELECT', 'FROM', 'WHERE'],
  },
  {
    name: 'suggests table constraint keywords after opening paren',
    sql: 'CREATE TABLE users (|',
    filterTypes: ['keyword'],
    shouldContain: ['PRIMARY KEY', 'CONSTRAINT', 'UNIQUE', 'CHECK', 'FOREIGN KEY'],
  },
  {
    name: 'suggests data types after column name',
    sql: 'CREATE TABLE users (id |',
    filterTypes: ['keyword'],
    shouldContain: ['INTEGER', 'INT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'TIMESTAMP', 'UUID', 'JSONB'],
  },
  {
    name: 'suggests BIGINT data type after column name',
    sql: 'CREATE TABLE users (id |',
    filterTypes: ['keyword'],
    shouldContain: ['BIGINT', 'BIGSERIAL'],
  },
  {
    name: 'suggests column constraints after data type',
    sql: 'CREATE TABLE users (id INTEGER |',
    filterTypes: ['keyword'],
    shouldContain: ['NOT NULL', 'PRIMARY KEY', 'UNIQUE', 'DEFAULT', 'REFERENCES', 'CHECK'],
  },
  {
    name: 'suggests more constraints after NOT NULL',
    sql: 'CREATE TABLE users (id INTEGER NOT NULL |',
    filterTypes: ['keyword'],
    shouldContain: ['PRIMARY KEY', 'UNIQUE', 'DEFAULT', 'REFERENCES'],
  },
  {
    name: 'suggests column definitions or table constraints after comma',
    sql: 'CREATE TABLE users (id INTEGER, |',
    filterTypes: ['keyword'],
    shouldContain: ['PRIMARY KEY', 'CONSTRAINT', 'UNIQUE', 'FOREIGN KEY', 'CHECK'],
  },
  {
    name: 'suggests table options after closing paren',
    sql: 'CREATE TABLE users (id INTEGER) |',
    filterTypes: ['keyword'],
    shouldContain: ['INHERITS', 'PARTITION BY', 'USING', 'WITH', 'TABLESPACE'],
  },
  {
    name: 'suggests partition types after PARTITION BY',
    sql: 'CREATE TABLE users (id INTEGER) |',
    filterTypes: ['keyword'],
    shouldContain: ['PARTITION BY RANGE', 'PARTITION BY LIST', 'PARTITION BY HASH'],
  },
  {
    name: 'filters data types by partial input',
    sql: 'CREATE TABLE users (id INT|',
    filterTypes: ['keyword'],
    shouldContain: ['INTEGER', 'INT', 'INT4RANGE', 'INT8RANGE', 'INTERVAL'],
    shouldNotContain: ['VARCHAR', 'TEXT', 'BOOLEAN'],
  },
  {
    name: 'suggests data types when typing partial after column name',
    sql: 'CREATE TABLE users (id B|',
    filterTypes: ['keyword'],
    shouldContain: ['BIGINT', 'BOOLEAN', 'BOOL', 'BYTEA', 'BOX'],
    shouldNotContain: ['DEFERRABLE', 'NOT DEFERRABLE'],
  },
  {
    name: 'suggests GENERATED identity options',
    sql: 'CREATE TABLE users (id INTEGER |',
    filterTypes: ['keyword'],
    shouldContain: ['GENERATED ALWAYS AS', 'GENERATED BY DEFAULT AS IDENTITY', 'GENERATED ALWAYS AS IDENTITY'],
  },
]

const partialMatchTests: SuggestionTestCase[] = [
  {
    name: 'filters columns by partial input',
    sql: 'SELECT us| FROM users',
    filterTypes: ['column'],
    shouldContain: ['username'],
    shouldNotContain: ['id'],
  },
  {
    name: 'filters tables by partial input',
    sql: 'SELECT * FROM use|',
    filterTypes: ['table', 'view'],
    shouldContain: ['users', 'user_profiles'],
    shouldNotContain: ['orders'],
  },
  {
    name: 'filters functions when typing partial name',
    sql: 'SELECT my_f| FROM users',
    filterTypes: ['function'],
    shouldContain: ['my_function'],
  },
]

const noSuggestionTests: NoSuggestionTestCase[] = [
  { name: 'inside string literal', sql: "SELECT 'hello |'" },
  { name: 'inside comment', sql: 'SELECT * -- comment |' },
]

// Tests for compound keyword completion
const compoundKeywordTests: SuggestionTestCase[] = [
  {
    name: 'suggests NULL/TRUE/FALSE after IS',
    sql: 'SELECT * FROM users WHERE active IS |',
    filterTypes: ['keyword'],
    shouldContain: ['NULL', 'NOT NULL', 'TRUE', 'FALSE'],
  },
  {
    name: 'suggests NULL/TRUE/FALSE after IS NOT',
    sql: 'SELECT * FROM users WHERE active IS NOT |',
    filterTypes: ['keyword'],
    shouldContain: ['NULL', 'TRUE', 'FALSE'],
  },
  {
    name: 'suggests FIRST/LAST after NULLS in ORDER BY',
    sql: 'SELECT * FROM users ORDER BY id DESC NULLS |',
    filterTypes: ['keyword'],
    shouldContain: ['FIRST', 'LAST'],
  },
]

const contextTests: ContextTestCase[] = [
  { name: 'SELECT context', sql: 'SELECT |', expectedSection: 'SELECT_COLUMNS', expectedStatementType: 'SELECT' },
  { name: 'FROM context', sql: 'SELECT * FROM |', expectedSection: 'FROM_TABLE' },
]

const rankingTests: RankingTestCase[] = [
  {
    name: 'columns first in SELECT context',
    sql: 'SELECT | FROM users',
    expectedFirstType: 'column',
  },
  {
    name: 'tables first in FROM context',
    sql: 'SELECT * FROM |',
    expectedFirstType: ['table', 'view', 'cte'],
  },
  {
    name: 'exact prefix match first',
    sql: 'SELECT id| FROM users',
    expectedFirstValue: 'id',
  },
  {
    name: 'TABLE ranked first after CREATE',
    sql: 'CREATE |',
    expectedFirstType: 'keyword',
    expectedFirstValue: 'TABLE',
  },
]

// ============================================================================
// TEST RUNNERS
// ============================================================================

function runSuggestionTests(tests: SuggestionTestCase[]) {
  for (const tc of tests) {
    it(tc.name, () => {
      const result = complete(tc.sql)
      let suggestions = result.suggestions

      if (tc.filterTypes) {
        suggestions = suggestions.filter((s) => tc.filterTypes!.includes(s.type))
      }

      const values = suggestions.map((s) => s.value)

      if (tc.shouldContain) {
        for (const expected of tc.shouldContain) {
          expect(values, `should contain "${expected}"`).toContain(expected)
        }
      }

      if (tc.shouldNotContain) {
        for (const unexpected of tc.shouldNotContain) {
          expect(values, `should not contain "${unexpected}"`).not.toContain(unexpected)
        }
      }

      if (tc.minCount !== undefined) {
        expect(suggestions.length, `should have at least ${tc.minCount} suggestions`).toBeGreaterThan(tc.minCount)
      }
    })
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

describe('autocomplete pipeline', () => {
  beforeAll(async () => {
    await ensureModuleLoaded()
  })

  describe('statement start', () => runSuggestionTests(statementStartTests))
  describe('SELECT clause', () => runSuggestionTests(selectClauseTests))
  describe('FROM clause', () => runSuggestionTests(fromClauseTests))
  describe('JOIN clause', () => runSuggestionTests(joinClauseTests))
  describe('table.column completion', () => runSuggestionTests(tableDotColumnTests))
  describe('WHERE clause', () => runSuggestionTests(whereClauseTests))
  describe('ORDER BY / GROUP BY', () => runSuggestionTests(orderGroupByTests))
  describe('CTE support', () => runSuggestionTests(cteTests))
  describe('CALL statement', () => runSuggestionTests(callTests))
  describe('INSERT statement', () => runSuggestionTests(insertTests))
  describe('UPDATE statement', () => runSuggestionTests(updateTests))
  describe('DELETE statement', () => runSuggestionTests(deleteTests))
  describe('CREATE TABLE statement', () => runSuggestionTests(createTableTests))
  describe('partial matching', () => runSuggestionTests(partialMatchTests))

  describe('no suggestions', () => {
    for (const tc of noSuggestionTests) {
      it(tc.name, () => {
        const result = complete(tc.sql)
        expect(result.suggestions).toHaveLength(0)
      })
    }
  })

  describe('compound keywords', () => runSuggestionTests(compoundKeywordTests))

  describe('context returned', () => {
    for (const tc of contextTests) {
      it(tc.name, () => {
        const result = complete(tc.sql)
        if (tc.expectedSection) {
          expect(result.context.section).toBe(tc.expectedSection)
        }
        if (tc.expectedStatementType) {
          expect(result.context.statementType).toBe(tc.expectedStatementType)
        }
      })
    }
  })

  describe('ranking', () => {
    for (const tc of rankingTests) {
      it(tc.name, () => {
        const result = complete(tc.sql)
        const first = result.suggestions[0]

        if (tc.expectedFirstValue) {
          expect(first?.value).toBe(tc.expectedFirstValue)
        }

        if (tc.expectedFirstType) {
          const expectedTypes = Array.isArray(tc.expectedFirstType) ? tc.expectedFirstType : [tc.expectedFirstType]
          expect(expectedTypes, `first type should be one of ${expectedTypes.join(', ')}`).toContain(first?.type)
        }
      })
    }
  })

  describe('timing measurement', () => {
    it('includes timing when enabled', () => {
      const cursorPos = 7
      const sql = 'SELECT '
      const result = runAutocompletePipeline({ sql, cursorPosition: cursorPos, schema: mockSchema }, { measureTiming: true })
      expect(result.timing).toBeDefined()
      expect(result.timing?.tokenize).toBeGreaterThanOrEqual(0)
      expect(result.timing?.parse).toBeGreaterThanOrEqual(0)
      expect(result.timing?.total).toBeGreaterThanOrEqual(0)
    })

    it('excludes timing when disabled', () => {
      const result = complete('SELECT |')
      expect(result.timing).toBeUndefined()
    })
  })

  describe('system functions', () => {
    it('suggests pg_sleep in SELECT context', () => {
      const result = complete('SELECT pg_sl|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('pg_sleep')
    })

    it('suggests coalesce in WHERE context', () => {
      const result = complete('SELECT * FROM t WHERE coal|', {
        defaultSchema: 'public',
        tables: [{ schema: 'public', name: 't', type: 'table', columns: [] }],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('coalesce')
    })

    it('suggests json_agg aggregate function', () => {
      const result = complete('SELECT json_a|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('json_agg')
    })

    it('suggests window functions', () => {
      const result = complete('SELECT row_n|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('row_number')
    })

    it('excludes PG16+ functions when pgVersion is 14', () => {
      const result = complete('SELECT array_sam|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
        pgVersion: 14,
      })
      const values = result.suggestions.map((s) => s.value)
      // array_sample requires PG 16+
      expect(values).not.toContain('array_sample')
    })

    it('includes PG16+ functions when pgVersion is 16', () => {
      const result = complete('SELECT array_sam|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
        pgVersion: 16,
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('array_sample')
    })

    it('defaults to PG14 when pgVersion is not specified', () => {
      const result = complete('SELECT array_shuf|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
        // pgVersion not specified - should default to 14
      })
      const values = result.suggestions.map((s) => s.value)
      // array_shuffle requires PG 16+, should not appear with default
      expect(values).not.toContain('array_shuffle')
    })

    it('boosts common functions like coalesce higher than uncommon ones', () => {
      const result = complete('SELECT co|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      // coalesce should appear and be ranked high (it's a common function)
      expect(values).toContain('coalesce')
      // coalesce should rank higher than less common co* functions like corr
      const coalesceIdx = values.indexOf('coalesce')
      const corrIdx = values.indexOf('corr')
      if (corrIdx !== -1) {
        expect(coalesceIdx).toBeLessThan(corrIdx)
      }
    })

    it('boosts now() as a top datetime function', () => {
      const result = complete('SELECT no|', {
        defaultSchema: 'public',
        tables: [],
        functions: [],
      })
      const values = result.suggestions.map((s) => s.value)
      expect(values).toContain('now')
      // now should be first among no* functions
      expect(values[0]).toBe('now')
    })
  })
})

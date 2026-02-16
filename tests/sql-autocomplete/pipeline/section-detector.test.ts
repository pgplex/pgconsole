// tests/sql-autocomplete/pipeline/section-detector.test.ts

import { describe, it, expect, beforeAll } from 'vitest'
import { detectSection } from '../../../src/lib/sql/autocomplete/section-detector'
import { tokenize } from '../../../src/lib/sql/autocomplete/tokenizer'
import { parseFromTokens } from '../../../src/lib/sql/autocomplete/parser'
import { ensureModuleLoaded } from '../../../src/lib/sql/core'
import type { SQLSection, StatementType } from '../../../src/lib/sql/autocomplete/types'

// ============================================================================
// TEST HELPERS
// ============================================================================

// | marks cursor position in SQL
function getContext(sqlWithCursor: string) {
  const cursorPos = sqlWithCursor.indexOf('|')
  const sql = sqlWithCursor.replace('|', '')
  const tokenized = tokenize(sql, cursorPos)
  const tree = parseFromTokens(tokenized, sql)
  return detectSection(tokenized, tree, cursorPos, sql)
}

// ============================================================================
// TEST CASE TYPES
// ============================================================================

interface SectionTestCase {
  sql: string // | marks cursor
  expected: SQLSection
}

interface TablePrefixTestCase {
  sql: string
  expectedPrefix: string
}

interface StatementTypeTestCase {
  sql: string
  expected: StatementType
}

interface ContextFlagTestCase {
  sql: string
  flag: 'isAtKeywordBoundary' | 'isAfterComma' | 'isAfterOrderByModifier'
  expected: boolean
}

interface DepthTestCase {
  sql: string
  expected: number
}

// ============================================================================
// TEST DATA
// ============================================================================

const selectSectionTests: SectionTestCase[] = [
  { sql: '|', expected: 'STATEMENT_START' },
  { sql: 'SELECT 1; |', expected: 'STATEMENT_START' },
  { sql: 'SELECT |', expected: 'SELECT_COLUMNS' },
  { sql: 'SELECT id, |', expected: 'SELECT_COLUMNS' },
  { sql: 'SELECT * FROM |', expected: 'FROM_TABLE' },
  { sql: 'SELECT * FROM users JOIN |', expected: 'JOIN_TABLE' },
  { sql: 'SELECT * FROM users LEFT JOIN |', expected: 'JOIN_TABLE' },
  { sql: 'SELECT * FROM users JOIN orders ON |', expected: 'JOIN_CONDITION' },
  { sql: 'SELECT * FROM users WHERE |', expected: 'WHERE_CONDITION' },
  { sql: 'SELECT * FROM users WHERE id = 1 AND |', expected: 'WHERE_CONDITION' },
  { sql: 'SELECT * FROM users WHERE id = 1 OR |', expected: 'WHERE_CONDITION' },
  { sql: 'SELECT * FROM users WHERE id NOT |', expected: 'WHERE_CONDITION' }, // NOT should stay in WHERE context
  { sql: 'SELECT * FROM users GROUP BY |', expected: 'GROUP_BY' },
  { sql: 'SELECT * FROM users GROUP BY id HAVING |', expected: 'HAVING' },
  { sql: 'SELECT * FROM users ORDER BY |', expected: 'ORDER_BY' },
  // After ORDER BY modifiers - should still be in ORDER_BY to suggest comma, NULLS, LIMIT, etc.
  { sql: 'SELECT * FROM users ORDER BY name ASC |', expected: 'ORDER_BY' },
  { sql: 'SELECT * FROM users ORDER BY name DESC |', expected: 'ORDER_BY' },
  { sql: 'SELECT * FROM users ORDER BY name DESC NULLS FIRST |', expected: 'ORDER_BY' },
  { sql: 'SELECT * FROM users ORDER BY name DESC NULLS LAST |', expected: 'ORDER_BY' },
  // Partial compound keywords - these should detect incomplete compound keywords
  // For now, LEFT/RIGHT/etc return JOIN_TABLE which suggests tables (acceptable)
  { sql: 'SELECT * FROM users LEFT |', expected: 'JOIN_TABLE' },
  // Compound keyword completions
  { sql: 'SELECT * FROM users WHERE active IS |', expected: 'IS_INCOMPLETE' },
  { sql: 'SELECT * FROM users WHERE active IS NOT |', expected: 'IS_NOT_INCOMPLETE' },
  { sql: 'SELECT * FROM users ORDER BY id DESC NULLS |', expected: 'NULLS_INCOMPLETE' },
]

const tablePrefixTests: TablePrefixTestCase[] = [
  { sql: 'SELECT users.|', expectedPrefix: 'users' },
  { sql: 'SELECT u.| FROM users u', expectedPrefix: 'u' },
  { sql: 'SELECT * FROM users u WHERE u.|', expectedPrefix: 'u' },
]

const insertSectionTests: SectionTestCase[] = [
  { sql: 'INSERT INTO |', expected: 'INSERT_TABLE' },
]

const updateSectionTests: SectionTestCase[] = [
  { sql: 'UPDATE |', expected: 'UPDATE_TABLE' },
  { sql: 'UPDATE users SET |', expected: 'UPDATE_SET' },
  { sql: 'UPDATE users SET name = |', expected: 'UPDATE_SET' },
  { sql: 'UPDATE users SET name = \'foo\' WHERE |', expected: 'WHERE_CONDITION' },
  { sql: 'UPDATE users SET name = \'foo\' FROM |', expected: 'FROM_TABLE' },
  { sql: 'UPDATE users SET name = \'foo\' RETURNING |', expected: 'RETURNING' },
]

const deleteSectionTests: SectionTestCase[] = [
  { sql: 'DELETE FROM |', expected: 'DELETE_TABLE' },
  { sql: 'DELETE FROM users |', expected: 'DELETE_TABLE' },
  { sql: 'DELETE FROM users WHERE |', expected: 'WHERE_CONDITION' },
  { sql: 'DELETE FROM users WHERE id = 1 AND |', expected: 'WHERE_CONDITION' },
  { sql: 'DELETE FROM users USING |', expected: 'FROM_TABLE' },
  { sql: 'DELETE FROM users USING orders WHERE |', expected: 'WHERE_CONDITION' },
  { sql: 'DELETE FROM users RETURNING |', expected: 'RETURNING' },
  { sql: 'DELETE FROM users WHERE id = 1 RETURNING |', expected: 'RETURNING' },
]

const createTableSectionTests: SectionTestCase[] = [
  // After CREATE, expect object type
  { sql: 'CREATE |', expected: 'CREATE_OBJECT' },
  { sql: 'CREATE TEMP |', expected: 'CREATE_OBJECT' },
  { sql: 'CREATE TEMPORARY |', expected: 'CREATE_OBJECT' },
  { sql: 'CREATE UNLOGGED |', expected: 'CREATE_OBJECT' },
  // After CREATE TABLE, expect table name
  { sql: 'CREATE TABLE |', expected: 'CREATE_TABLE_NAME' },
  { sql: 'CREATE TEMP TABLE |', expected: 'CREATE_TABLE_NAME' },
  { sql: 'CREATE TEMPORARY TABLE |', expected: 'CREATE_TABLE_NAME' },
  { sql: 'CREATE UNLOGGED TABLE |', expected: 'CREATE_TABLE_NAME' },
  { sql: 'CREATE TABLE IF NOT EXISTS |', expected: 'CREATE_TABLE_NAME' },
  // Inside column list - after opening paren
  { sql: 'CREATE TABLE users (|', expected: 'CREATE_TABLE_COLUMNS' },
  // After column name, expect type
  { sql: 'CREATE TABLE users (id |', expected: 'CREATE_TABLE_COLUMN_TYPE' },
  // After type, expect constraints or comma
  { sql: 'CREATE TABLE users (id INTEGER |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  { sql: 'CREATE TABLE users (id INT |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  { sql: 'CREATE TABLE users (id BIGINT |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  { sql: 'CREATE TABLE users (id VARCHAR |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  // After constraint, still in constraint context
  { sql: 'CREATE TABLE users (id INTEGER NOT NULL |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  { sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY |', expected: 'CREATE_TABLE_COLUMN_CONSTRAINT' },
  // After comma, expect new column or table constraint
  { sql: 'CREATE TABLE users (id INTEGER, |', expected: 'CREATE_TABLE_COLUMNS' },
  { sql: 'CREATE TABLE users (id INTEGER NOT NULL, |', expected: 'CREATE_TABLE_COLUMNS' },
  { sql: 'CREATE TABLE users (id INTEGER, name VARCHAR, |', expected: 'CREATE_TABLE_COLUMNS' },
  // After closing paren, expect table options
  { sql: 'CREATE TABLE users (id INTEGER) |', expected: 'CREATE_TABLE_OPTIONS' },
  { sql: 'CREATE TABLE users (id INTEGER, name VARCHAR) |', expected: 'CREATE_TABLE_OPTIONS' },
]

const statementTypeTests: StatementTypeTestCase[] = [
  { sql: 'SELECT |', expected: 'SELECT' },
  { sql: 'INSERT INTO |', expected: 'INSERT' },
  { sql: 'UPDATE |', expected: 'UPDATE' },
  { sql: 'DELETE FROM |', expected: 'DELETE' },
  { sql: 'WITH cte AS (SELECT 1) SELECT |', expected: 'WITH' },
]

const contextFlagTests: ContextFlagTestCase[] = [
  { sql: 'SELECT |', flag: 'isAtKeywordBoundary', expected: true },
  { sql: 'SELECT id, |', flag: 'isAfterComma', expected: true },
  // ORDER BY modifier flags
  { sql: 'SELECT * FROM users ORDER BY name ASC |', flag: 'isAfterOrderByModifier', expected: true },
  { sql: 'SELECT * FROM users ORDER BY name DESC |', flag: 'isAfterOrderByModifier', expected: true },
  { sql: 'SELECT * FROM users ORDER BY name DESC NULLS FIRST |', flag: 'isAfterOrderByModifier', expected: true },
  { sql: 'SELECT * FROM users ORDER BY |', flag: 'isAfterOrderByModifier', expected: false },
]

const depthTests: DepthTestCase[] = [
  { sql: 'SELECT |', expected: 0 },
  { sql: 'SELECT * FROM (SELECT |', expected: 1 },
  { sql: 'SELECT * FROM (SELECT * FROM (SELECT |', expected: 2 },
]

// ============================================================================
// TEST RUNNER
// ============================================================================

function runSectionTests(tests: SectionTestCase[]) {
  for (const tc of tests) {
    it(`"${tc.sql}" → ${tc.expected}`, () => {
      const context = getContext(tc.sql)
      expect(context.section).toBe(tc.expected)
    })
  }
}

describe('section-detector', () => {
  beforeAll(async () => {
    await ensureModuleLoaded()
  })

  describe('SELECT statement sections', () => {
    runSectionTests(selectSectionTests)
  })

  describe('table.column prefix', () => {
    for (const tc of tablePrefixTests) {
      it(`"${tc.sql}" → prefix "${tc.expectedPrefix}"`, () => {
        const context = getContext(tc.sql)
        expect(context.tablePrefix).toBe(tc.expectedPrefix)
      })
    }
  })

  describe('INSERT statement', () => {
    runSectionTests(insertSectionTests)
  })

  describe('UPDATE statement', () => {
    runSectionTests(updateSectionTests)
  })

  describe('DELETE statement', () => {
    runSectionTests(deleteSectionTests)
  })

  describe('CREATE TABLE statement', () => {
    runSectionTests(createTableSectionTests)
  })

  describe('statement type detection', () => {
    for (const tc of statementTypeTests) {
      it(`"${tc.sql}" → ${tc.expected}`, () => {
        const context = getContext(tc.sql)
        expect(context.statementType).toBe(tc.expected)
      })
    }
  })

  describe('context flags', () => {
    for (const tc of contextFlagTests) {
      it(`"${tc.sql}" → ${tc.flag}=${tc.expected}`, () => {
        const context = getContext(tc.sql)
        expect(context[tc.flag]).toBe(tc.expected)
      })
    }
  })

  describe('subquery depth', () => {
    for (const tc of depthTests) {
      it(`"${tc.sql}" → depth ${tc.expected}`, () => {
        const context = getContext(tc.sql)
        expect(context.depth).toBe(tc.expected)
      })
    }
  })
})

import { describe, test, expect } from 'vitest'
import { formatSql, formatSqlOneLine } from '@/lib/sql/format'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { discoverTests } from '../test-utils.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

const testDirs = discoverTests(testsDir)

describe('SQL Formatter', () => {
  testDirs.forEach((testName) => {
    test(testName, async () => {
      const testDir = path.join(testsDir, testName)
      const expectedPath = path.join(testDir, 'expected.sql')

      if (!fs.existsSync(expectedPath)) {
        throw new Error(
          `Missing expected.sql for test "${testName}". Create the expected output file.`
        )
      }

      const sql = fs.readFileSync(path.join(testDir, 'query.sql'), 'utf-8')
      const expected = fs.readFileSync(expectedPath, 'utf-8')
      const result = await formatSql(sql)

      expect(result).toBe(expected.trimEnd())
    })
  })

  test('should have at least one test case', () => {
    expect(testDirs.length).toBeGreaterThan(0)
  })
})

describe('formatSql error handling', () => {
  test('returns original SQL on parse error', async () => {
    const invalidSql = 'SELEKT * FROM users'
    const result = await formatSql(invalidSql)
    expect(result).toBe(invalidSql)
  })

  test('returns empty string for whitespace-only input', async () => {
    expect(await formatSql('')).toBe('')
    expect(await formatSql('   ')).toBe('   ')
  })
})

describe('formatSqlOneLine', () => {
  test('collapses whitespace to single line', () => {
    const sql = `SELECT
      id,
      name
    FROM
      users`
    expect(formatSqlOneLine(sql)).toBe('SELECT id, name FROM users')
  })

  test('handles empty string', () => {
    expect(formatSqlOneLine('')).toBe('')
    expect(formatSqlOneLine('   ')).toBe('   ')
  })

  test('preserves single line queries', () => {
    const sql = 'SELECT * FROM users'
    expect(formatSqlOneLine(sql)).toBe('SELECT * FROM users')
  })
})

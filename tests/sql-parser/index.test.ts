import { describe, test, expect } from 'vitest'
import { parseSql } from '@/lib/sql/core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { discoverTests } from '../test-utils.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const testDirs = discoverTests(testsDir)

describe('SQL Parser', () => {
  testDirs.forEach((testName) => {
    test(testName, async () => {
      const testDir = path.join(testsDir, testName)
      const astPath = path.join(testDir, 'ast.json')

      if (!fs.existsSync(astPath)) {
        throw new Error(
          `Missing ast.json for test "${testName}". Run: pnpm run test:fixture`
        )
      }

      const sql = fs.readFileSync(path.join(testDir, 'query.sql'), 'utf-8')
      const expected = JSON.parse(fs.readFileSync(astPath, 'utf-8'))
      const result = await parseSql(sql)

      expect(result.statements).toEqual(expected)
    })
  })

  test('should have at least one test case', () => {
    expect(testDirs.length).toBeGreaterThan(0)
  })
})

import { parseSql } from '../src/lib/sql/core.js'
import { discoverTests } from '../tests/test-utils.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tests/sql-parser')

async function generateFixtures() {
  console.log('Generating SQL parser fixtures...\n')

  const testDirs = discoverTests(testsDir)

  if (testDirs.length === 0) {
    console.log('No test directories found with query.sql files.')
    return
  }

  let successCount = 0
  let errorCount = 0

  for (const testName of testDirs) {
    const testDir = path.join(testsDir, testName)

    try {
      const sql = fs.readFileSync(path.join(testDir, 'query.sql'), 'utf-8')
      const result = await parseSql(sql)

      fs.writeFileSync(
        path.join(testDir, 'ast.json'),
        JSON.stringify(result.statements, null, 2) + '\n'
      )

      console.log(`✓ ${testName}`)
      successCount++
    } catch (error) {
      console.error(`✗ ${testName}:`)
      console.error(error)
      errorCount++
    }
  }

  console.log(`\n${successCount} fixture(s) generated successfully`)
  if (errorCount > 0) {
    console.error(`${errorCount} fixture(s) failed`)
    process.exit(1)
  }
}

generateFixtures()

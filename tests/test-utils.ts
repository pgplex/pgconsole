import fs from 'fs'
import path from 'path'

/**
 * Discovers test directories containing query.sql files
 */
export function discoverTests(testsDir: string): string[] {
  return fs
    .readdirSync(testsDir)
    .filter((name) => {
      const fullPath = path.join(testsDir, name)
      return (
        fs.statSync(fullPath).isDirectory() &&
        fs.existsSync(path.join(fullPath, 'query.sql'))
      )
    })
    .sort()
}

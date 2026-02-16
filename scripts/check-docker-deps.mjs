#!/usr/bin/env node

// CI check: verify that all esbuild externals used by server code have matching
// entries in package.json. This ensures gen-runtime-package.mjs will succeed
// during Docker build.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

// Extract externals from build-server.mjs
const buildScript = readFileSync(join(rootDir, 'scripts/build-server.mjs'), 'utf-8')
const externalsMatch = buildScript.match(/external:\s*\[([\s\S]*?)\]/)
if (!externalsMatch) {
  console.error('Could not find external array in build-server.mjs')
  process.exit(1)
}
const externals = externalsMatch[1]
  .split('\n')
  .map((line) => line.match(/'([^']+)'/)?.[1])
  .filter(Boolean)

// Collect all server source files
function collectFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full))
    } else if (/\.[tj]sx?$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const serverFiles = collectFiles(join(rootDir, 'server'))
const serverSource = serverFiles.map((f) => readFileSync(f, 'utf-8')).join('\n')

// Find which externals are actually imported in server code
const importedExternals = externals.filter((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`from\\s+['"]${escaped}['"/]|require\\(['"]${escaped}['"/]`).test(serverSource)
})

// Verify each imported external exists in package.json
const missing = importedExternals.filter((name) => !allDeps[name])

if (missing.length > 0) {
  console.error('esbuild externals imported by server code but missing from package.json:')
  for (const name of missing) {
    console.error(`  - ${name}`)
  }
  console.error('\nAdd them to dependencies in package.json.')
  process.exit(1)
}

console.log(`Checked ${importedExternals.length} runtime externals — all present in package.json.`)

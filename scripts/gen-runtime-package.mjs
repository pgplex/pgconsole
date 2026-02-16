#!/usr/bin/env node

// Generates a minimal package.json for the Docker runtime stage.
//
// Runtime deps = esbuild externals (packages that can't be bundled due to
// native modules, WASM, etc.). Versions are read from the root package.json
// so there's a single source of truth.
//
// Usage: node scripts/gen-runtime-package.mjs > runtime-package.json

import { readFileSync } from 'fs'
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

// Resolve versions from package.json
const deps = {}
const missing = []
for (const name of externals) {
  if (allDeps[name]) {
    deps[name] = allDeps[name]
  } else {
    missing.push(name)
  }
}

if (missing.length > 0) {
  console.error('esbuild externals not found in package.json:')
  for (const name of missing) {
    console.error(`  - ${name}`)
  }
  console.error('\nAdd them to dependencies in package.json.')
  process.exit(1)
}

const runtimePkg = {
  name: 'pgconsole-runtime',
  type: 'module',
  dependencies: deps,
}

console.log(JSON.stringify(runtimePkg, null, 2))

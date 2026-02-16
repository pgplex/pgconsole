import { getConnections } from './config'
import { createClient } from './db'
import { testAndCacheConnection } from './connection-cache'

/**
 * Test all configured connections on startup to populate connection cache
 * Throws an error if any connection fails
 */
export async function testAllConnections(): Promise<void> {
  const connections = getConnections()
  const eagerConnections = connections.filter(c => !c.lazy)
  const lazyConnections = connections.filter(c => c.lazy)

  if (connections.length === 0) {
    console.log('No connections configured')
    return
  }

  if (eagerConnections.length === 0) {
    console.log(`All ${connections.length} connection(s) are lazy, skipping startup test`)
    for (const conn of lazyConnections) {
      console.log(`  ○ ${conn.name} (lazy)`)
    }
    return
  }

  console.log(`Testing ${eagerConnections.length} connection(s)...`)

  const results = await Promise.allSettled(
    eagerConnections.map(async (conn) => {
      const client = createClient({
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        password: conn.password,
        sslMode: conn.ssl_mode || 'prefer',
      })

      try {
        // Test connection and cache PostgreSQL version
        const version = await testAndCacheConnection(client, conn.id)
        console.log(`  ✓ ${conn.name} (PostgreSQL ${version})`)
      } finally {
        await client.end()
      }
    })
  )

  // Check for failures
  const failures: Array<{ name: string; error: string }> = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const conn = eagerConnections[i]
      const error = result.reason instanceof Error ? result.reason.message : 'Unknown error'
      console.log(`  ✗ ${conn.name}: ${error}`)
      failures.push({ name: conn.name, error })
    }
  })

  if (failures.length > 0) {
    throw new Error(
      `Failed to connect to ${failures.length} connection(s):\n` +
      failures.map(f => `  - ${f.name}: ${f.error}`).join('\n')
    )
  }

  // Print lazy connections
  for (const conn of lazyConnections) {
    console.log(`  ○ ${conn.name} (lazy)`)
  }
}

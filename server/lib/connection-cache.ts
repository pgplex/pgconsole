// In-memory cache for connection runtime information
export interface ConnectionInfo {
  version: string // PostgreSQL major version (e.g., "16")
}

interface PartialConnectionInfo {
  version?: string
}

const connectionCache = new Map<string, ConnectionInfo>()

// Get connection info, throws if not found or version missing
export function getConnectionInfo(connectionId: string): ConnectionInfo {
  const info = connectionCache.get(connectionId)
  if (!info?.version) {
    throw new Error('Connection info not found. Ensure connection is tested first.')
  }
  return info
}

// Get connection info without throwing (for optional access)
export function tryGetConnectionInfo(connectionId: string): PartialConnectionInfo {
  return connectionCache.get(connectionId) || {}
}

export function setConnectionVersion(connectionId: string, version: string): void {
  const info: ConnectionInfo = { version }
  connectionCache.set(connectionId, info)
}

export function clearConnectionCache(connectionId?: string): void {
  if (connectionId) {
    connectionCache.delete(connectionId)
  } else {
    connectionCache.clear()
  }
}

/**
 * Test database connection and cache PostgreSQL version
 *
 * Performs the following steps:
 * 1. Executes SELECT 1 to verify connectivity
 * 2. Fetches PostgreSQL version via SELECT version()
 * 3. Extracts major version number (e.g., "16")
 * 4. Caches the version for this connection
 *
 * @param client - postgres.js client instance
 * @param connectionId - Connection ID to cache version for
 * @returns PostgreSQL major version (e.g., "16")
 * @throws Error if version cannot be extracted
 */
export async function testAndCacheConnection(client: any, connectionId: string): Promise<string> {
  // Test connectivity
  await client`SELECT 1`

  // Fetch version
  const versionResult = await client`SELECT version()`
  const versionString = (versionResult[0]?.version as string) || ''

  // Extract major version (e.g., "PostgreSQL 16.3..." -> "16")
  const match = versionString.match(/PostgreSQL (\d+)/)
  if (!match?.[1]) {
    throw new Error(`Failed to extract PostgreSQL version from: ${versionString}`)
  }
  const version = match[1]

  // Cache it
  setConnectionVersion(connectionId, version)

  return version
}

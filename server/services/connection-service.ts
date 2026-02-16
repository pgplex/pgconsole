import { ConnectError, Code } from "@connectrpc/connect"
import type { ServiceImpl } from "@connectrpc/connect"
import { ConnectionService } from "../../src/gen/connection_connect"
import { getConnections, getConnectionById, getLabels } from "../lib/config"
import type { ConnectionConfig } from "../lib/config"
import { createClient } from "../lib/db"
import { tryGetConnectionInfo, testAndCacheConnection } from "../lib/connection-cache"
import { getUserFromContext } from "../connect"
import { getAccessibleConnectionIds, getUserPermissions, requireAnyPermission, type Permission } from "../lib/iam"

function toConnectionResponse(conn: ConnectionConfig, userPermissions: Set<Permission>) {
  const allLabels = getLabels()
  const connectionLabelIds = conn.labels || []
  const hydratedLabels = connectionLabelIds
    .map(labelId => allLabels.find(l => l.id === labelId))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)

  const info = tryGetConnectionInfo(conn.id)

  return {
    id: conn.id,
    name: conn.name,
    description: '',
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    hasPassword: !!conn.password,
    sslMode: conn.ssl_mode || 'prefer',
    labels: hydratedLabels,
    version: info.version || '',
    permissions: Array.from(userPermissions),
  }
}

export const connectionServiceHandlers: ServiceImpl<typeof ConnectionService> = {
  async listConnections(_req, context) {
    const user = await getUserFromContext(context.values)
    const connections = getConnections()

    // If no user (shouldn't happen if auth is enabled), return empty
    if (!user) {
      return { connections: [] }
    }

    // Filter connections by IAM permissions
    const allIds = connections.map(c => c.id)
    const accessibleIds = new Set(getAccessibleConnectionIds(user.email, allIds))

    const filtered = connections.filter(c => accessibleIds.has(c.id))

    return {
      connections: filtered.map((c) => {
        const perms = getUserPermissions(user.email, c.id)
        return toConnectionResponse(c, perms)
      }),
    }
  },

  async getConnection(req, context) {
    if (!req.id) {
      throw new ConnectError('id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.id)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    const user = await getUserFromContext(context.values)
    const perms = requireAnyPermission(user, req.id)

    return { connection: toConnectionResponse(conn, perms) }
  },

  async testConnection(req, context) {
    if (!req.id) {
      throw new ConnectError('id is required', Code.InvalidArgument)
    }

    const conn = getConnectionById(req.id)
    if (!conn) {
      throw new ConnectError('Connection not found', Code.NotFound)
    }

    const user = await getUserFromContext(context.values)
    requireAnyPermission(user, req.id)

    const start = Date.now()
    const client = createClient({
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: conn.password,
      sslMode: conn.ssl_mode || 'prefer',
    }, user?.email)

    try {
      // Test connection and cache PostgreSQL version
      await testAndCacheConnection(client, req.id)

      const latencyMs = Date.now() - start

      return { success: true, error: '', latencyMs }
    } catch (err) {
      const latencyMs = Date.now() - start
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        latencyMs,
      }
    } finally {
      await client.end()
    }
  },
}

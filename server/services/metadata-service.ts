import { ConnectError, Code } from "@connectrpc/connect"
import type { ServiceImpl } from "@connectrpc/connect"
import { MetadataService } from "../../src/gen/metadata_connect"
import { getConnectionById } from "../lib/config"
import { withConnection, type ConnectionDetails } from "../lib/db"
import { getUserFromContext } from "../connect"
import { requirePermission } from "../lib/iam"

function getConnectionDetails(connectionId: string): ConnectionDetails {
  const conn = getConnectionById(connectionId)
  if (!conn) {
    throw new ConnectError("Connection not found", Code.NotFound)
  }
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: conn.password,
    sslMode: conn.ssl_mode || "prefer",
    lockTimeout: conn.lock_timeout,
    statementTimeout: conn.statement_timeout,
  }
}

async function requireMetadataTable(details: ConnectionDetails, email?: string): Promise<void> {
  const exists = await withConnection(details, async (sql) => {
    const rows = await sql`
      SELECT 1 FROM pg_class
      WHERE relname = '_pgconsole' AND relkind = 'r'
    `
    return rows.length > 0
  }, email)

  if (!exists) {
    throw new ConnectError(
      "Metadata table not initialized. Call InitMetadataTable first.",
      Code.FailedPrecondition
    )
  }
}

export const metadataServiceHandlers: ServiceImpl<typeof MetadataService> = {
  async initMetadataTable(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, "admin", "initialize metadata table")

    const details = getConnectionDetails(req.connectionId)

    await withConnection(details, async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS _pgconsole (
          key         TEXT NOT NULL PRIMARY KEY,
          value       JSONB NOT NULL,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    }, user?.email)

    return { success: true }
  },

  async getMetadata(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument)
    }
    if (!req.key) {
      throw new ConnectError("key is required", Code.InvalidArgument)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, "read", "read metadata")

    const details = getConnectionDetails(req.connectionId)
    await requireMetadataTable(details, user?.email)

    const row = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT key, value, updated_at
        FROM _pgconsole
        WHERE key = ${req.key}
      `
      return rows[0]
    }, user?.email)

    if (!row) {
      throw new ConnectError(`Key not found: ${req.key}`, Code.NotFound)
    }

    return {
      entry: {
        key: row.key as string,
        value: JSON.stringify(row.value),
        updatedAt: (row.updated_at as Date).toISOString(),
      },
    }
  },

  async setMetadata(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument)
    }
    if (!req.key) {
      throw new ConnectError("key is required", Code.InvalidArgument)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, "write", "write metadata")

    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(req.value)
    } catch {
      throw new ConnectError("value must be valid JSON", Code.InvalidArgument)
    }

    const details = getConnectionDetails(req.connectionId)
    await requireMetadataTable(details, user?.email)

    const row = await withConnection(details, async (sql) => {
      const rows = await sql`
        INSERT INTO _pgconsole (key, value, updated_at)
        VALUES (${req.key}, ${sql.json(parsedValue)}, now())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        RETURNING key, value, updated_at
      `
      return rows[0]
    }, user?.email)

    return {
      entry: {
        key: row.key as string,
        value: JSON.stringify(row.value),
        updatedAt: (row.updated_at as Date).toISOString(),
      },
    }
  },

  async deleteMetadata(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument)
    }
    if (!req.key) {
      throw new ConnectError("key is required", Code.InvalidArgument)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, "write", "delete metadata")

    const details = getConnectionDetails(req.connectionId)
    await requireMetadataTable(details, user?.email)

    const deleted = await withConnection(details, async (sql) => {
      const rows = await sql`
        DELETE FROM _pgconsole WHERE key = ${req.key} RETURNING 1
      `
      return rows.length > 0
    }, user?.email)

    return { success: deleted }
  },

  async listMetadata(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument)
    }

    const user = await getUserFromContext(context.values)
    requirePermission(user, req.connectionId, "read", "list metadata")

    const details = getConnectionDetails(req.connectionId)
    await requireMetadataTable(details, user?.email)

    const rows = await withConnection(details, async (sql) => {
      if (req.prefix) {
        return sql`
          SELECT key, value, updated_at
          FROM _pgconsole
          WHERE key LIKE ${req.prefix + '%'}
          ORDER BY key
        `
      }
      return sql`
        SELECT key, value, updated_at
        FROM _pgconsole
        ORDER BY key
      `
    }, user?.email)

    return {
      entries: rows.map((row) => ({
        key: row.key as string,
        value: JSON.stringify(row.value),
        updatedAt: (row.updated_at as Date).toISOString(),
      })),
    }
  },
}

import { ConnectError, Code } from "@connectrpc/connect";
import type { ServiceImpl } from "@connectrpc/connect";
import { QueryService } from "../../src/gen/query_connect";
import { getConnectionById } from "../lib/config";
import { createClient, formatAppName, type ConnectionDetails } from "../lib/db";
import type postgres from "postgres";
import { getUserFromContext } from "../connect";
import { hasPermission, requirePermission, requirePermissions, requireAnyPermission } from "../lib/iam";
import { detectRequiredPermissions } from "../lib/sql-permissions";
import { auditSQL, auditExport } from "../lib/audit";

// Track active queries by queryId -> { pid, connectionDetails, email }
const activeQueries = new Map<string, { pid: number; details: ConnectionDetails; email: string }>();

function getConnectionDetails(connectionId: string): ConnectionDetails {
  const conn = getConnectionById(connectionId);
  if (!conn) {
    throw new ConnectError("Connection not found", Code.NotFound);
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
  };
}

async function withConnection<T>(
  details: ConnectionDetails,
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>,
  appUser?: string
): Promise<T> {
  const client = createClient(details, appUser);

  try {
    return await fn(client);
  } catch (err) {
    // Re-throw as ConnectError to preserve the error message
    const message = err instanceof Error ? err.message : "Connection failed";
    throw new ConnectError(message, Code.Unavailable);
  } finally {
    await client.end();
  }
}

interface ColumnMeta {
  name: string;
  type: string;
  tableName: string;
  schemaName: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  hasDefault: boolean;
}

async function getColumnMetadata(
  client: ReturnType<typeof postgres>,
  columns: { name: string; type: number; table?: number }[]
): Promise<ColumnMeta[]> {
  if (columns.length === 0) return [];

  // Get unique table OIDs (filter out 0 which means no table)
  const tableOids = [...new Set(columns.map(c => c.table).filter(t => t && t > 0))];

  // Get type names
  const typeOids = [...new Set(columns.map(c => c.type))];
  const typeRows = await client`
    SELECT oid::int as oid, typname
    FROM pg_type
    WHERE oid = ANY(${typeOids}::oid[])
  `;
  const oidToType = new Map<number, string>();
  for (const row of typeRows) {
    oidToType.set(row.oid as number, row.typname as string);
  }

  // Get table info, primary key columns, column nullability, and columns with defaults
  let tableInfo = new Map<number, { schema: string; table: string; pkColumns: Set<string>; notNullColumns: Set<string>; defaultColumns: Set<string> }>();
  if (tableOids.length > 0) {
    const tableRows = await client`
      SELECT
        c.oid::int as oid,
        n.nspname as schema_name,
        c.relname as table_name,
        COALESCE(
          (SELECT array_agg(a.attname)
           FROM pg_constraint con
           JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
           WHERE con.conrelid = c.oid AND con.contype = 'p'),
          ARRAY[]::text[]
        ) as pk_columns,
        COALESCE(
          (SELECT array_agg(a.attname)
           FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attnum > 0 AND a.attnotnull),
          ARRAY[]::text[]
        ) as not_null_columns,
        COALESCE(
          (SELECT array_agg(a.attname)
           FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attnum > 0 AND a.atthasdef),
          ARRAY[]::text[]
        ) as default_columns
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.oid = ANY(${tableOids}::oid[])
    `;
    for (const row of tableRows) {
      tableInfo.set(row.oid as number, {
        schema: row.schema_name as string,
        table: row.table_name as string,
        pkColumns: new Set(row.pk_columns as string[]),
        notNullColumns: new Set(row.not_null_columns as string[]),
        defaultColumns: new Set(row.default_columns as string[]),
      });
    }
  }

  return columns.map(col => {
    const info = col.table ? tableInfo.get(col.table) : undefined;
    const isNotNull = info?.notNullColumns.has(col.name) || false;
    return {
      name: col.name,
      type: oidToType.get(col.type) || 'unknown',
      tableName: info?.table || '',
      schemaName: info?.schema || '',
      isPrimaryKey: info?.pkColumns.has(col.name) || false,
      isNullable: !isNotNull,
      hasDefault: info?.defaultColumns.has(col.name) || false,
    };
  });
}

export const queryServiceHandlers: ServiceImpl<typeof QueryService> = {
  async *executeSQL(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.sql?.trim()) {
      throw new ConnectError("sql is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    if (!user) {
      throw new ConnectError('Authentication required', Code.Unauthenticated);
    }

    // Determine required permissions and statement analysis
    const analysis = await detectRequiredPermissions(req.sql);
    requirePermissions(user, req.connectionId, analysis.permissions, `execute query`);

    const details = getConnectionDetails(req.connectionId);
    const queryId = req.queryId;
    const client = createClient(details, user.email);

    const start = Date.now();
    let backendPid = 0;

    try {
      // Get backend PID for cancellation support and monitoring correlation
      const pidResult = await client`SELECT pg_backend_pid() as pid`;
      backendPid = pidResult[0]?.pid as number ?? 0;

      if (queryId && backendPid) {
        activeQueries.set(queryId, { pid: backendPid, details, email: user.email });
      }

      // Set search_path if provided
      if (req.searchPath) {
        // Quote each schema name to safely escape
        const schemas = req.searchPath.split(',').map(s => {
          const trimmed = s.trim()
          return `"${trimmed.replace(/"/g, '""')}"`
        })
        await client.unsafe(`SET search_path TO ${schemas.join(', ')}`);
      }

      // First, yield just the PID so client can display it during execution
      yield {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: "",
        backendPid,
      };

      // Wrap multi-statement SQL in a transaction when safe. Without this,
      // PostgreSQL's Simple Query protocol runs each statement in autocommit
      // mode, so a failure in statement N leaves 1..N-1 committed.
      // Statements like CREATE DATABASE, VACUUM, CREATE INDEX CONCURRENTLY
      // cannot run inside a transaction and are excluded.
      const sql = (analysis.statementCount > 1 && analysis.transactionSafe)
        ? `BEGIN;\n${req.sql}\nCOMMIT;`
        : req.sql;
      const result = await client.unsafe(sql);

      const executionTimeMs = Date.now() - start;

      // Extract column metadata
      let columnMeta: ColumnMeta[] = [];
      if (result.columns) {
        columnMeta = await getColumnMetadata(
          client,
          result.columns.map(col => ({
            name: col.name,
            type: col.type,
            table: col.table,
          }))
        );
      } else if (result.length > 0) {
        // Fallback: no metadata available
        columnMeta = Object.keys(result[0]).map(name => ({
          name,
          type: 'unknown',
          tableName: '',
          schemaName: '',
          isPrimaryKey: false,
          isNullable: true,
          hasDefault: false,
        }));
      }

      // Get column names for row value mapping
      const columns = columnMeta.map(cm => cm.name);

      // Convert rows to string values
      const rowsData = result.map((row: Record<string, unknown>) => ({
        values: columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          if (val instanceof Date) return val.toISOString();
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        }),
      }));

      // Yield the final results
      auditSQL(user.email, req.connectionId, details.database, req.sql, true, executionTimeMs, result.length)
      yield {
        columns: columnMeta.map(cm => ({
          name: cm.name,
          type: cm.type,
          tableName: cm.tableName,
          schemaName: cm.schemaName,
          isPrimaryKey: cm.isPrimaryKey,
          isNullable: cm.isNullable,
          hasDefault: cm.hasDefault,
        })),
        rows: rowsData,
        rowCount: result.count ?? result.length,
        executionTimeMs,
        error: "",
        backendPid,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Query execution failed";
      const executionTimeMs = Date.now() - start;

      // Build a richer error with line context, detail, and hint from PostgreSQL
      let fullError = errorMessage;
      const pgErr = err as Record<string, unknown>;
      const pos = pgErr?.position;
      if (typeof pos === 'string' && pos) {
        const charPos = parseInt(pos, 10);
        if (charPos > 0) {
          const before = req.sql.slice(0, charPos - 1);
          const lineNumber = before.split('\n').length;
          const lines = req.sql.split('\n');
          const offendingLine = lines[lineNumber - 1];
          if (offendingLine !== undefined) {
            fullError = `ERROR at Line ${lineNumber}: ${errorMessage}\nLINE ${lineNumber}: ${offendingLine}`;
          }
        }
      }
      if (typeof pgErr?.detail === 'string' && pgErr.detail) {
        fullError += `\nDETAIL: ${pgErr.detail}`;
      }
      if (typeof pgErr?.hint === 'string' && pgErr.hint) {
        fullError += `\nHINT: ${pgErr.hint}`;
      }

      auditSQL(user.email, req.connectionId, details.database, req.sql, false, executionTimeMs, undefined, errorMessage)
      yield {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs,
        error: fullError,
        backendPid,
      };
    } finally {
      // Clean up
      if (queryId) {
        activeQueries.delete(queryId);
      }
      await client.end();
    }
  },

  async cancelQuery(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.queryId) {
      throw new ConnectError("query_id is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    if (!user) {
      throw new ConnectError('Authentication required', Code.Unauthenticated);
    }

    const queryInfo = activeQueries.get(req.queryId);
    if (!queryInfo) {
      return {
        cancelled: false,
        error: "Query not found or already completed",
      };
    }

    // Check permission: user can cancel own query, or needs admin for others
    const isOwnQuery = queryInfo.email === user.email;
    if (!isOwnQuery && !hasPermission(user.email, req.connectionId, 'admin')) {
      throw new ConnectError("Permission denied: cancelling others' queries requires admin permission", Code.PermissionDenied);
    }

    try {
      // Use a separate connection to cancel the query
      const result = await withConnection(queryInfo.details, async (sql) => {
        const cancelResult = await sql`SELECT pg_cancel_backend(${queryInfo.pid}) as cancelled`;
        return cancelResult[0]?.cancelled as boolean;
      }, user.email);

      return {
        cancelled: result ?? false,
        error: "",
      };
    } catch (err) {
      return {
        cancelled: false,
        error: err instanceof Error ? err.message : "Failed to cancel query",
      };
    }
  },

  async getSchemas(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const schemas = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `;
      return rows.map((r: { schema_name: string }) => r.schema_name);
    }, user?.email);

    return { schemas };
  },

  async getTables(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const tables = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = ${req.schema}
        ORDER BY table_type, table_name
      `;
      return rows.map((r: { table_name: string; table_type: string }) => ({
        name: r.table_name,
        type: r.table_type === "VIEW" ? "view" : "table",
      }));
    }, user?.email);

    return { tables };
  },

  async getColumns(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const columns = await withConnection(details, async (sql) => {
      // Use pg_attribute directly to support tables, views, AND materialized views
      // information_schema.columns doesn't include materialized views
      const rows = await sql`
        SELECT
          a.attname as column_name,
          CASE WHEN t.typtype = 'b' AND t.typelem != 0 AND t.typname LIKE '\\_%'
            THEN (SELECT et.typname FROM pg_catalog.pg_type et WHERE et.oid = t.typelem) || '[]'
            ELSE t.typname
          END as data_type,
          NOT a.attnotnull as is_nullable,
          COALESCE(
            (SELECT true FROM pg_catalog.pg_constraint con
             WHERE con.conrelid = c.oid
               AND con.contype = 'p'
               AND a.attnum = ANY(con.conkey)),
            false
          ) as is_primary_key,
          pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_value,
          col_description(c.oid, a.attnum) as comment
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = ${req.schema}
          AND c.relname = ${req.table}
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
      `;
      return rows.map((r: {
        column_name: string;
        data_type: string;
        is_nullable: boolean;
        is_primary_key: boolean;
        default_value: string | null;
        comment: string | null;
      }) => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable,
        isPrimaryKey: r.is_primary_key,
        defaultValue: r.default_value ?? '',
        comment: r.comment ?? '',
      }));
    }, user?.email);

    return { columns };
  },

  async getTableInfo(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const metadata = await withConnection(details, async (sql) => {
      // Get metadata from pg_catalog for tables, views, and materialized views
      // relkind: 'r' = table, 'p' = partitioned table, 'v' = view, 'm' = materialized view
      const result = await sql`
        SELECT
          c.relkind as kind,
          pg_get_userbyid(c.relowner) as owner,
          c.reltuples::bigint as row_count,
          CASE WHEN c.relkind IN ('r', 'p', 'm') THEN pg_total_relation_size(c.oid) ELSE 0 END as total_size,
          CASE WHEN c.relkind IN ('r', 'p', 'm') THEN pg_table_size(c.oid) ELSE 0 END as table_size,
          CASE WHEN c.relkind IN ('r', 'p', 'm') THEN pg_indexes_size(c.oid) ELSE 0 END as index_size,
          pg_encoding_to_char(d.encoding) as encoding,
          d.datcollate as collation,
          obj_description(c.oid, 'pg_class') as comment,
          pg_get_viewdef(c.oid, true) as definition
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_database d ON d.datname = current_database()
        WHERE n.nspname = ${req.schema}
          AND c.relname = ${req.table}
          AND c.relkind IN ('r', 'p', 'v', 'm')
      `;

      if (result.length === 0) {
        return {
          owner: "",
          rowCount: BigInt(0),
          totalSize: BigInt(0),
          tableSize: BigInt(0),
          indexSize: BigInt(0),
          encoding: "",
          collation: "",
          comment: "",
          kind: "",
          definition: "",
        };
      }

      const row = result[0];
      const kind = row.kind as string;
      return {
        owner: (row.owner as string) ?? "",
        rowCount: BigInt(row.row_count as number) ?? BigInt(0),
        totalSize: BigInt(row.total_size as number) ?? BigInt(0),
        tableSize: BigInt(row.table_size as number) ?? BigInt(0),
        indexSize: BigInt(row.index_size as number) ?? BigInt(0),
        encoding: (row.encoding as string) ?? "",
        collation: (row.collation as string) ?? "",
        comment: (row.comment as string) ?? "",
        kind: kind === 'r' ? 'table' : kind === 'p' ? 'partitioned_table' : kind === 'v' ? 'view' : kind === 'm' ? 'materialized_view' : '',
        definition: (row.definition as string) ?? "",
      };
    }, user?.email);

    return { metadata };
  },

  async getIndexes(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const indexes = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          i.relname as name,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary,
          am.amname as method,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
          pg_get_indexdef(ix.indexrelid) as definition
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_am am ON am.oid = i.relam
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE n.nspname = ${req.schema}
          AND t.relname = ${req.table}
        GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexrelid
        ORDER BY ix.indisprimary DESC, i.relname
      `;
      return rows.map((r: { name: string; is_unique: boolean; is_primary: boolean; method: string; columns: string[]; definition: string }) => ({
        name: r.name,
        isUnique: r.is_unique,
        isPrimary: r.is_primary,
        method: r.method,
        columns: r.columns,
        definition: r.definition,
      }));
    }, user?.email);

    return { indexes };
  },

  async getConstraints(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const result = await withConnection(details, async (sql) => {
      const rows = await sql`
        WITH target AS (
          SELECT c.oid FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ${req.schema} AND c.relname = ${req.table}
        )
        -- Forward: constraints on this table
        SELECT
          'constraint' as source,
          con.conname as name,
          CASE con.contype
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'c' THEN 'CHECK'
            WHEN 'x' THEN 'EXCLUDE'
          END as type,
          array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) FILTER (WHERE a.attname IS NOT NULL) as columns,
          pg_get_constraintdef(con.oid) as definition,
          CASE WHEN con.contype = 'f' THEN
            (SELECT nf.nspname || '.' || cf.relname FROM pg_class cf JOIN pg_namespace nf ON nf.oid = cf.relnamespace WHERE cf.oid = con.confrelid)
          END as ref_table,
          CASE WHEN con.contype = 'f' THEN
            (SELECT array_agg(af.attname ORDER BY array_position(con.confkey, af.attnum))
             FROM pg_attribute af WHERE af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey))
          END as ref_columns
        FROM pg_constraint con
        JOIN target t ON con.conrelid = t.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(con.conkey)
        GROUP BY con.oid, con.conname, con.contype, con.confrelid, con.confkey
        UNION ALL
        -- Reverse: FK constraints from other tables referencing this table
        SELECT
          'referenced_by' as source,
          con.conname as name,
          'FOREIGN KEY' as type,
          (SELECT array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum))
           FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)) as columns,
          pg_get_constraintdef(con.oid) as definition,
          (SELECT ns.nspname || '.' || cs.relname FROM pg_class cs JOIN pg_namespace ns ON ns.oid = cs.relnamespace WHERE cs.oid = con.conrelid) as ref_table,
          (SELECT array_agg(af.attname ORDER BY array_position(con.confkey, af.attnum))
           FROM pg_attribute af WHERE af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)) as ref_columns
        FROM pg_constraint con
        JOIN target t ON con.confrelid = t.oid
        WHERE con.contype = 'f'
      `;

      const mapRow = (r: { name: string; type: string; columns: string[] | null; definition: string; ref_table: string | null; ref_columns: string[] | null }) => ({
        name: r.name,
        type: r.type,
        columns: r.columns || [],
        definition: r.definition,
        refTable: r.ref_table || '',
        refColumns: r.ref_columns || [],
      });

      const constraints = rows
        .filter((r: { source: string }) => r.source === 'constraint')
        .sort((a: { type: string; name: string }, b: { type: string; name: string }) => {
          const order: Record<string, number> = { 'PRIMARY KEY': 1, 'FOREIGN KEY': 2, 'UNIQUE': 3, 'CHECK': 4, 'EXCLUDE': 5 };
          const diff = (order[a.type] ?? 6) - (order[b.type] ?? 6);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        })
        .map(mapRow);

      const referencedBy = rows
        .filter((r: { source: string }) => r.source === 'referenced_by')
        .map(mapRow);

      return { constraints, referencedBy };
    }, user?.email);

    return result;
  },

  async getTriggers(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const triggers = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          t.tgname as name,
          CASE
            WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
            WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
            ELSE 'AFTER'
          END as timing,
          array_to_string(ARRAY[
            CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
            CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
            CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
            CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END
          ]::text[], ' OR ') as event,
          CASE WHEN t.tgtype & 1 = 1 THEN 'ROW' ELSE 'STATEMENT' END as level,
          p.proname as function,
          t.tgenabled != 'D' as enabled
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE n.nspname = ${req.schema}
          AND c.relname = ${req.table}
          AND NOT t.tgisinternal
        ORDER BY t.tgname
      `;
      return rows.map((r: { name: string; timing: string; event: string; level: string; function: string; enabled: boolean }) => ({
        name: r.name,
        timing: r.timing,
        event: r.event,
        level: r.level,
        function: r.function,
        enabled: r.enabled,
      }));
    }, user?.email);

    return { triggers };
  },

  async getPolicies(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const policies = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          pol.polname as name,
          CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
          END as command,
          CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as permissive,
          CASE WHEN pol.polroles = '{0}' THEN ARRAY['PUBLIC']
               ELSE ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles))
          END as roles,
          pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
          pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ${req.schema}
          AND c.relname = ${req.table}
        ORDER BY pol.polname
      `;
      return rows.map((r: { name: string; command: string; permissive: string; roles: string[]; using_expr: string | null; check_expr: string | null }) => ({
        name: r.name,
        command: r.command,
        permissive: r.permissive,
        roles: r.roles,
        usingExpr: r.using_expr || '',
        checkExpr: r.check_expr || '',
      }));
    }, user?.email);

    return { policies };
  },

  async getGrants(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.table) {
      throw new ConnectError("table is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const grants = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          COALESCE(grantee, 'PUBLIC') as grantee,
          array_agg(privilege_type ORDER BY privilege_type) as privileges,
          grantor
        FROM information_schema.table_privileges
        WHERE table_schema = ${req.schema}
          AND table_name = ${req.table}
        GROUP BY grantee, grantor
        ORDER BY grantee
      `;
      return rows.map((r: { grantee: string; privileges: string[]; grantor: string }) => ({
        grantee: r.grantee,
        privileges: r.privileges,
        grantor: r.grantor,
      }));
    }, user?.email);

    return { grants };
  },

  async getMaterializedViews(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const materializedViews = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT matviewname as name
        FROM pg_matviews
        WHERE schemaname = ${req.schema}
        ORDER BY matviewname
      `;
      return rows.map((r: { name: string }) => ({
        name: r.name,
      }));
    }, user?.email);

    return { materializedViews };
  },

  async getFunctions(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const functions = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          p.proname as name,
          pg_get_function_result(p.oid) as return_type,
          pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${req.schema}
          AND p.prokind = 'f'
          AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
              AND d.deptype = 'e'
          )
        ORDER BY p.proname
      `;
      return rows.map((r: { name: string; return_type: string; arguments: string }) => ({
        name: r.name,
        returnType: r.return_type,
        arguments: r.arguments,
      }));
    }, user?.email);

    return { functions };
  },

  async getProcedures(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const procedures = await withConnection(details, async (sql) => {
      const rows = await sql`
        SELECT
          p.proname as name,
          pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${req.schema}
          AND p.prokind = 'p'
          AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
              AND d.deptype = 'e'
          )
        ORDER BY p.proname
      `;
      return rows.map((r: { name: string; arguments: string }) => ({
        name: r.name,
        arguments: r.arguments,
      }));
    }, user?.email);

    return { procedures };
  },

  async getFunctionInfo(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.name) {
      throw new ConnectError("name is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const metadata = await withConnection(details, async (sql) => {
      // Get function/procedure metadata and definition
      // Filter by arguments if provided (for overloaded functions)
      const filterByArgs = req.arguments !== undefined && req.arguments !== '';
      const result = await sql`
        SELECT
          p.proname as name,
          CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' ELSE 'unknown' END as kind,
          pg_get_userbyid(p.proowner) as owner,
          l.lanname as language,
          pg_get_function_result(p.oid) as return_type,
          pg_get_function_identity_arguments(p.oid) as arguments,
          pg_get_functiondef(p.oid) as definition,
          CASE p.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' ELSE 'volatile' END as volatility,
          obj_description(p.oid, 'pg_proc') as comment
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = ${req.schema}
          AND p.proname = ${req.name}
          AND (NOT ${filterByArgs} OR pg_get_function_identity_arguments(p.oid) = ${req.arguments})
        LIMIT 1
      `;

      if (result.length === 0) {
        return {
          name: "",
          kind: "",
          owner: "",
          language: "",
          returnType: "",
          arguments: "",
          definition: "",
          volatility: "",
          comment: "",
        };
      }

      const row = result[0];
      return {
        name: (row.name as string) ?? "",
        kind: (row.kind as string) ?? "",
        owner: (row.owner as string) ?? "",
        language: (row.language as string) ?? "",
        returnType: (row.return_type as string) ?? "",
        arguments: (row.arguments as string) ?? "",
        definition: (row.definition as string) ?? "",
        volatility: (row.volatility as string) ?? "",
        comment: (row.comment as string) ?? "",
      };
    }, user?.email);

    return { metadata };
  },

  async getFunctionDependencies(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.schema) {
      throw new ConnectError("schema is required", Code.InvalidArgument);
    }
    if (!req.name) {
      throw new ConnectError("name is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);

    const dependencies = await withConnection(details, async (sql) => {
      const filterByArgs = req.arguments !== undefined && req.arguments !== '';

      // First get the function definition
      const funcResult = await sql`
        SELECT pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ${req.schema}
          AND p.proname = ${req.name}
          AND (NOT ${filterByArgs} OR pg_get_function_identity_arguments(p.oid) = ${req.arguments})
        LIMIT 1
      `;

      if (funcResult.length === 0) {
        return [];
      }

      const definition = (funcResult[0].definition as string) || '';

      // Get all tables, views, materialized views, functions, procedures in the database
      // Then check which ones are referenced in the function body
      const objectsResult = await sql`
        SELECT
          n.nspname as schema,
          c.relname as name,
          CASE c.relkind
            WHEN 'r' THEN 'table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized_view'
          END as type,
          NULL as arguments
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'v', 'm')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        UNION ALL
        SELECT
          n.nspname as schema,
          p.proname as name,
          CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' END as type,
          pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prokind IN ('f', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND NOT (n.nspname = ${req.schema} AND p.proname = ${req.name})
      `;

      // Check which objects are referenced in the function definition
      // Look for patterns like: schema.name, "schema"."name", or just name (for tables in search_path)
      const deps: Array<{ schema: string; name: string; type: string; arguments: string }> = [];
      const definitionLower = definition.toLowerCase();

      for (const obj of objectsResult) {
        const schema = obj.schema as string;
        const name = obj.name as string;
        const type = obj.type as string;
        const args = (obj.arguments as string) || '';

        // Skip the function itself
        if (schema === req.schema && name === req.name) continue;

        // Check various reference patterns (case-insensitive)
        const patterns = [
          `${schema}.${name}`.toLowerCase(),           // schema.name
          `"${schema}"."${name}"`.toLowerCase(),       // "schema"."name"
          `${schema}."${name}"`.toLowerCase(),         // schema."name"
          `"${schema}".${name}`.toLowerCase(),         // "schema".name
        ];

        // For objects in public schema or same schema, also check unqualified name
        if (schema === 'public' || schema === req.schema) {
          patterns.push(name.toLowerCase());           // just name
          patterns.push(`"${name}"`.toLowerCase());    // "name"
        }

        // Check if any pattern is found in the definition
        // Use word boundary checking to avoid partial matches
        const found = patterns.some(pattern => {
          // Create regex with word boundaries
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:[^a-z0-9_]|$)`, 'i');
          return regex.test(definition);
        });

        if (found) {
          deps.push({ schema, name, type, arguments: args });
        }
      }

      // Sort by type, schema, name
      deps.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        if (a.schema !== b.schema) return a.schema.localeCompare(b.schema);
        return a.name.localeCompare(b.name);
      });

      return deps;
    }, user?.email);

    return { dependencies };
  },

  async getActiveSessions(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requireAnyPermission(user, req.connectionId);

    const details = getConnectionDetails(req.connectionId);
    const isAdmin = user ? hasPermission(user.email, req.connectionId, 'admin') : false;
    const userAppName = user ? formatAppName(user.email) : null;

    try {
      const sessions = await withConnection(details, async (sql) => {
        const rows = await sql`
          SELECT
            pid,
            usename,
            datname,
            application_name,
            client_addr::text,
            state,
            query,
            query_start::text,
            state_change::text
          FROM pg_stat_activity
          WHERE datname = ${details.database}
            AND pid != pg_backend_pid()
            AND (${isAdmin} OR application_name = ${userAppName})
          ORDER BY query_start DESC NULLS LAST
        `;
        return rows.map((r: {
          pid: number;
          usename: string | null;
          datname: string;
          application_name: string | null;
          client_addr: string | null;
          state: string | null;
          query: string | null;
          query_start: string | null;
          state_change: string | null;
        }) => ({
          pid: r.pid,
          usename: r.usename ?? "",
          datname: r.datname,
          applicationName: r.application_name ?? "",
          clientAddr: r.client_addr ?? "",
          state: r.state ?? "",
          query: r.query ?? "",
          queryStart: r.query_start ?? "",
          stateChange: r.state_change ?? "",
        }));
      }, user?.email);

      return { sessions, error: "" };
    } catch (err) {
      return {
        sessions: [],
        error: err instanceof Error ? err.message : "Failed to get active sessions",
      };
    }
  },

  async terminateSession(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }
    if (!req.pid) {
      throw new ConnectError("pid is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    requirePermission(user, req.connectionId, 'admin', 'terminate session');

    const details = getConnectionDetails(req.connectionId);

    try {
      const result = await withConnection(details, async (sql) => {
        const rows = await sql`SELECT pg_terminate_backend(${req.pid}) as success`;
        return rows[0]?.success as boolean;
      }, user?.email);

      return { success: result ?? false, error: "" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to terminate session",
      };
    }
  },

  async auditExport(req, context) {
    if (!req.connectionId) {
      throw new ConnectError("connection_id is required", Code.InvalidArgument);
    }

    const user = await getUserFromContext(context.values);
    if (!user) {
      throw new ConnectError('Authentication required', Code.Unauthenticated);
    }

    const conn = getConnectionById(req.connectionId);
    if (!conn) {
      throw new ConnectError("Connection not found", Code.NotFound);
    }

    auditExport(user.email, req.connectionId, conn.database, req.sql, req.rowCount, req.format);

    return {};
  },
};

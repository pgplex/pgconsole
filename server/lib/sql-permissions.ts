import { parseSql, type Statement, type Expr } from "../../src/lib/sql/core";
import { PG_SYSTEM_FUNCTIONS } from "../../src/lib/sql/pg-system-functions";
import type { Permission } from "./config";

// Build permission lookup map from system functions catalog
const functionPermissions = new Map(
  PG_SYSTEM_FUNCTIONS.map(fn => [fn.name, fn.permission])
);

export function getRequiredPermission(kind: Statement['kind']): Permission {
  switch (kind) {
    // Read-only
    case 'select':
    case 'show':
      return 'read'

    // Explain
    case 'explain':
      return 'explain'

    // Execute (stored procedures)
    case 'call':
      return 'execute'

    // DML (data modification)
    case 'insert':
    case 'update':
    case 'delete':
      return 'write'

    // DDL (schema modification)
    case 'create_table':
    case 'alter_table':
    case 'drop':
    case 'create_view':
    case 'create_index':
    case 'create_function':
    case 'truncate':
    case 'create_schema':
    case 'create_sequence':
    case 'alter_sequence':
    case 'create_type':
    case 'create_extension':
    case 'create_trigger':
    case 'comment':
    case 'grant':
    case 'revoke':
    case 'refresh_matview':
      return 'ddl'

    // COPY (data import/export via server filesystem)
    case 'copy':
      return 'write'

    // Session/transaction control - safe operations
    case 'set':
    case 'transaction':
    case 'vacuum':
      return 'read'

    // Admin (role/user/database/server management)
    case 'create_role':
    case 'alter_role':
    case 'drop_role':
    case 'create_db':
    case 'alter_db':
    case 'drop_db':
    case 'create_tablespace':
    case 'drop_tablespace':
    case 'alter_system':
    case 'reindex':
    case 'cluster':
    case 'load':
    case 'checkpoint':
    case 'create_subscription':
    case 'alter_subscription':
    case 'drop_subscription':
    case 'create_publication':
    case 'alter_publication':
    case 'reassign_owned':
    case 'drop_owned':
    case 'unknown':
      return 'admin'
  }
}

/** Extract all function names from an expression tree */
export function extractFunctionNames(expr: Expr | null): string[] {
  if (!expr) return []

  const names: string[] = []

  function visit(e: Expr) {
    switch (e.kind) {
      case 'func':
        names.push(e.name.toLowerCase())
        for (const arg of e.args) visit(arg)
        if (e.filter) visit(e.filter)
        break
      case 'binary':
        visit(e.left)
        visit(e.right)
        break
      case 'unary':
        visit(e.arg)
        break
      case 'case':
        if (e.arg) visit(e.arg)
        for (const w of e.whens) {
          visit(w.when)
          visit(w.then)
        }
        if (e.else) visit(e.else)
        break
      case 'typecast':
        visit(e.arg)
        break
      case 'nulltest':
        visit(e.arg)
        break
      case 'array':
        for (const el of e.elements) visit(el)
        break
      case 'coalesce':
        for (const arg of e.args) visit(arg)
        break
      case 'sublink':
        // Subqueries are handled separately
        break
    }
  }

  visit(expr)
  return names
}

/** Extract all function names from a statement */
export function extractFunctionsFromStatement(stmt: Statement): string[] {
  const names: string[] = []

  if (stmt.kind === 'select') {
    for (const col of stmt.columns) {
      names.push(...extractFunctionNames(col.expr))
    }
    if (stmt.where) names.push(...extractFunctionNames(stmt.where))
    if (stmt.having) names.push(...extractFunctionNames(stmt.having))
    if (stmt.groupBy) {
      for (const g of stmt.groupBy) names.push(...extractFunctionNames(g))
    }
    if (stmt.orderBy) {
      for (const o of stmt.orderBy) names.push(...extractFunctionNames(o.expr))
    }
    if (stmt.limit) names.push(...extractFunctionNames(stmt.limit))
    if (stmt.offset) names.push(...extractFunctionNames(stmt.offset))
  } else if (stmt.kind === 'insert') {
    if (stmt.values) {
      for (const row of stmt.values) {
        for (const val of row) names.push(...extractFunctionNames(val))
      }
    }
    if (stmt.returning) {
      for (const r of stmt.returning) names.push(...extractFunctionNames(r.expr))
    }
  } else if (stmt.kind === 'update') {
    for (const a of stmt.assignments) {
      names.push(...extractFunctionNames(a.value))
    }
    if (stmt.where) names.push(...extractFunctionNames(stmt.where))
    if (stmt.returning) {
      for (const r of stmt.returning) names.push(...extractFunctionNames(r.expr))
    }
  } else if (stmt.kind === 'delete') {
    if (stmt.where) names.push(...extractFunctionNames(stmt.where))
    if (stmt.returning) {
      for (const r of stmt.returning) names.push(...extractFunctionNames(r.expr))
    }
  }

  return names
}

/** Get permission required for a function by name */
export function getFunctionPermission(name: string): Permission {
  return (functionPermissions.get(name) ?? 'read') as Permission
}

// Statement kinds that cannot run inside a transaction block
const TRANSACTION_UNSAFE_KINDS = new Set([
  'create_db', 'drop_db',
  'create_tablespace', 'drop_tablespace',
  'alter_system',
  'vacuum',
  'cluster',
  'reindex',
])

export interface SqlAnalysis {
  permissions: Set<Permission>
  statementCount: number
  /** True when all statements can safely run inside a transaction block */
  transactionSafe: boolean
}

/** Detect all permissions required to execute a SQL statement */
export async function detectRequiredPermissions(sql: string): Promise<SqlAnalysis> {
  try {
    const parsed = await parseSql(sql)
    if (parsed.statements.length === 0) {
      return { permissions: new Set(['read']), statementCount: 0, transactionSafe: true }
    }

    const permissions = new Set<Permission>()
    let transactionSafe = true

    // Check all statements in multi-statement SQL
    for (const stmt of parsed.statements) {
      permissions.add(getRequiredPermission(stmt.kind))

      if (TRANSACTION_UNSAFE_KINDS.has(stmt.kind) || stmt.kind === 'transaction') {
        transactionSafe = false
      }
      // CREATE INDEX CONCURRENTLY / DROP INDEX CONCURRENTLY
      if (stmt.kind === 'create_index' && stmt.concurrent) {
        transactionSafe = false
      }
      if (stmt.kind === 'drop' && stmt.objectType === 'index' && /\bCONCURRENTLY\b/i.test(stmt.source)) {
        transactionSafe = false
      }

      // Add permissions required by function calls
      for (const name of extractFunctionsFromStatement(stmt)) {
        permissions.add(getFunctionPermission(name))
      }
    }

    return { permissions, statementCount: parsed.statements.length, transactionSafe }
  } catch {
    // Parse failed - require admin for safety
    return { permissions: new Set(['admin']), statementCount: 1, transactionSafe: false }
  }
}

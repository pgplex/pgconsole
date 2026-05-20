/**
 * SQL statement generators for context menu actions.
 * Generates single-line SQL and uses the formatter for consistent output.
 */

import { formatSql } from './format'

export interface Column {
  name: string
  type: string
  nullable: boolean
}

const RESERVED_IDENTIFIERS = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric',
  'both', 'case', 'cast', 'check', 'collate', 'column', 'constraint', 'create',
  'current_catalog', 'current_date', 'current_role', 'current_time',
  'current_timestamp', 'current_user', 'default', 'deferrable', 'desc',
  'distinct', 'do', 'else', 'end', 'except', 'false', 'fetch', 'for', 'foreign',
  'from', 'grant', 'group', 'having', 'in', 'initially', 'intersect', 'into',
  'lateral', 'leading', 'limit', 'localtime', 'localtimestamp', 'not', 'null',
  'offset', 'on', 'only', 'or', 'order', 'placing', 'primary', 'references',
  'returning', 'select', 'session_user', 'some', 'symmetric', 'table', 'then',
  'to', 'trailing', 'true', 'union', 'unique', 'user', 'using', 'variadic',
  'when', 'where', 'window', 'with',
])

function quoteIdentifier(identifier: string): string {
  const isSafe = /^[a-z_][a-z0-9_]*$/.test(identifier) && !RESERVED_IDENTIFIERS.has(identifier)
  if (isSafe) return identifier
  return `"${identifier.replace(/"/g, '""')}"`
}

function formatTableName(schema: string | null | undefined, table: string): string {
  const quotedTable = quoteIdentifier(table)
  return schema ? `${quoteIdentifier(schema)}.${quotedTable}` : quotedTable
}

interface IdentifierReplacement {
  token: string
  quoted: string
}

function createTokenFactory(identifiers: string[]) {
  const used = new Set(identifiers)
  let index = 0

  return () => {
    let token: string
    do {
      token = `pgconsole_ident_${index}_token`
      index += 1
    } while (used.has(token))
    used.add(token)
    return token
  }
}

function quoteIdentifierForFormatting(
  identifier: string,
  replacements: IdentifierReplacement[],
  nextToken: () => string
): string {
  const quoted = quoteIdentifier(identifier)
  if (quoted === identifier) return identifier

  const token = nextToken()
  replacements.push({ token, quoted })
  return token
}

function formatTableNameForFormatting(
  schema: string | null | undefined,
  table: string,
  replacements: IdentifierReplacement[],
  nextToken: () => string
): string {
  const quotedTable = quoteIdentifierForFormatting(table, replacements, nextToken)
  return schema
    ? `${quoteIdentifierForFormatting(schema, replacements, nextToken)}.${quotedTable}`
    : quotedTable
}

async function formatGeneratedSql(sql: string, replacements: IdentifierReplacement[]): Promise<string> {
  let formatted = await formatSql(sql)
  for (const { token, quoted } of replacements) {
    formatted = formatted.replaceAll(token, quoted)
  }
  return formatted
}

/**
 * Generate a SELECT statement.
 */
export async function generateSelect(schema: string | null | undefined, table: string): Promise<string> {
  const replacements: IdentifierReplacement[] = []
  const nextToken = createTokenFactory([schema ?? '', table])
  const sql = `SELECT * FROM ${formatTableNameForFormatting(schema, table, replacements, nextToken)} LIMIT 100`
  return formatGeneratedSql(sql, replacements)
}

/**
 * Generate an INSERT statement with column placeholders.
 */
export async function generateInsert(schema: string | null | undefined, table: string, columns: Column[]): Promise<string> {
  if (columns.length === 0) return ''

  const replacements: IdentifierReplacement[] = []
  const nextToken = createTokenFactory([schema ?? '', table, ...columns.map((c) => c.name)])
  const columnNames = columns.map((c) => quoteIdentifierForFormatting(c.name, replacements, nextToken)).join(', ')
  const valuePlaceholders = columns.map((c) => `'<${c.name}>'`).join(', ')

  const sql = `INSERT INTO ${formatTableNameForFormatting(schema, table, replacements, nextToken)} (${columnNames}) VALUES (${valuePlaceholders})`
  return formatGeneratedSql(sql, replacements)
}

/**
 * Generate an UPDATE statement.
 * Primary key columns are used in WHERE clause and excluded from SET.
 */
export async function generateUpdate(
  schema: string | null | undefined,
  table: string,
  columns: Column[],
  pkColumns: string[]
): Promise<string> {
  if (columns.length === 0) return ''

  const replacements: IdentifierReplacement[] = []
  const nextToken = createTokenFactory([
    schema ?? '',
    table,
    ...columns.map((c) => c.name),
    ...pkColumns,
  ])
  const pkSet = new Set(pkColumns)
  const nonPkColumns = columns.filter((c) => !pkSet.has(c.name))

  const setColumns = nonPkColumns.length > 0 ? nonPkColumns : columns
  const setClause = setColumns
    .map((c) => `${quoteIdentifierForFormatting(c.name, replacements, nextToken)} = '<${c.name}>'`)
    .join(', ')

  if (pkColumns.length > 0) {
    const whereClause = pkColumns
      .map((c) => `${quoteIdentifierForFormatting(c, replacements, nextToken)} = '<${c}>'`)
      .join(' AND ')
    const sql = `UPDATE ${formatTableNameForFormatting(schema, table, replacements, nextToken)} SET ${setClause} WHERE ${whereClause}`
    return formatGeneratedSql(sql, replacements)
  } else {
    const sql = `UPDATE ${formatTableNameForFormatting(schema, table, replacements, nextToken)} SET ${setClause}`
    const formatted = await formatGeneratedSql(sql, replacements)
    return formatted.replace(/;$/, '') + '\nWHERE\n  /* condition */;'
  }
}

/**
 * Generate a DELETE statement.
 * Uses primary key columns in WHERE clause if available.
 */
export async function generateDelete(
  schema: string | null | undefined,
  table: string,
  pkColumns: string[]
): Promise<string> {
  const replacements: IdentifierReplacement[] = []
  const nextToken = createTokenFactory([schema ?? '', table, ...pkColumns])

  if (pkColumns.length > 0) {
    const whereClause = pkColumns
      .map((c) => `${quoteIdentifierForFormatting(c, replacements, nextToken)} = '<${c}>'`)
      .join(' AND ')
    const sql = `DELETE FROM ${formatTableNameForFormatting(schema, table, replacements, nextToken)} WHERE ${whereClause}`
    return formatGeneratedSql(sql, replacements)
  } else {
    const sql = `DELETE FROM ${formatTableNameForFormatting(schema, table, replacements, nextToken)}`
    const formatted = await formatGeneratedSql(sql, replacements)
    return formatted.replace(/;$/, '') + '\nWHERE\n  /* condition */;'
  }
}

/**
 * Generate a CREATE TABLE statement template.
 */
export async function generateCreateTable(): Promise<string> {
  const sql = `CREATE TABLE table_name (id serial PRIMARY KEY, column_name data_type)`
  return formatSql(sql)
}

/**
 * Generate an ALTER TABLE ADD COLUMN statement.
 */
export async function generateAlterAddColumn(schema: string | null | undefined, table: string): Promise<string> {
  const sql = `ALTER TABLE ${formatTableName(schema, table)} ADD COLUMN column_name data_type`
  return formatSql(sql)
}

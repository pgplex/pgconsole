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

/**
 * Generate a SELECT statement.
 */
export async function generateSelect(table: string): Promise<string> {
  const sql = `SELECT * FROM ${table} LIMIT 100`
  return formatSql(sql)
}

/**
 * Generate an INSERT statement with column placeholders.
 */
export async function generateInsert(table: string, columns: Column[]): Promise<string> {
  if (columns.length === 0) return ''

  const columnNames = columns.map((c) => c.name).join(', ')
  const valuePlaceholders = columns.map((c) => `'<${c.name}>'`).join(', ')

  const sql = `INSERT INTO ${table} (${columnNames}) VALUES (${valuePlaceholders})`
  return formatSql(sql)
}

/**
 * Generate an UPDATE statement.
 * Primary key columns are used in WHERE clause and excluded from SET.
 */
export async function generateUpdate(
  table: string,
  columns: Column[],
  pkColumns: string[]
): Promise<string> {
  if (columns.length === 0) return ''

  const pkSet = new Set(pkColumns)
  const nonPkColumns = columns.filter((c) => !pkSet.has(c.name))

  // If all columns are PK columns, use all columns in SET
  const setColumns = nonPkColumns.length > 0 ? nonPkColumns : columns
  const setClause = setColumns.map((c) => `${c.name} = '<${c.name}>'`).join(', ')

  if (pkColumns.length > 0) {
    const whereClause = pkColumns.map((c) => `${c} = '<${c}>'`).join(' AND ')
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`
    return formatSql(sql)
  } else {
    // No PK - format without WHERE, then append placeholder comment
    const sql = `UPDATE ${table} SET ${setClause}`
    const formatted = await formatSql(sql)
    return formatted.replace(/;$/, '') + '\nWHERE\n  /* condition */;'
  }
}

/**
 * Generate a DELETE statement.
 * Uses primary key columns in WHERE clause if available.
 */
export async function generateDelete(table: string, pkColumns: string[]): Promise<string> {
  if (pkColumns.length > 0) {
    const whereClause = pkColumns.map((c) => `${c} = '<${c}>'`).join(' AND ')
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`
    return formatSql(sql)
  } else {
    // No PK - format without WHERE, then append placeholder comment
    const sql = `DELETE FROM ${table}`
    const formatted = await formatSql(sql)
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
export async function generateAlterAddColumn(table: string): Promise<string> {
  const sql = `ALTER TABLE ${table} ADD COLUMN column_name data_type`
  return formatSql(sql)
}

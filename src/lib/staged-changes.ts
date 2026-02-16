import type { ColumnMetadata } from '@/components/sql-editor/hooks/useEditorTabs'

export type StagedChangeType = 'delete' | 'update' | 'insert'

export interface TableChange {
  tableName: string
  schemaName: string
  primaryKeyColumns: string[]
  rows: Record<string, unknown>[]
}

export interface UpdateTableChange extends TableChange {
  originalRows: Record<string, unknown>[]
  updatedRows: Record<string, unknown>[]
}

export interface StagedUpdateChange {
  id: string
  type: 'update'
  tables: UpdateTableChange[]
  rowCount: number
  createdAt: Date
  rowIndices?: number[]
}

export interface StagedChange {
  id: string
  type: StagedChangeType
  tables: TableChange[]
  rowCount: number
  createdAt: Date
  rowIndices?: number[] // Row indices for highlighting in the result grid
  // For updates: track original values to generate WHERE clause
  originalRows?: Record<string, unknown>[]
}

export function generateStagedChangeName(change: StagedChange): string {
  const tableNames = change.tables.map(t => t.tableName).join(', ')
  const isJoined = change.tables.length > 1

  switch (change.type) {
    case 'delete':
      return isJoined
        ? `Delete ${change.rowCount} joined row${change.rowCount > 1 ? 's' : ''} from ${tableNames}`
        : `Delete ${change.rowCount} row${change.rowCount > 1 ? 's' : ''} from ${tableNames}`
    case 'update':
      return `Update ${change.rowCount} row${change.rowCount > 1 ? 's' : ''} in ${tableNames}`
    case 'insert':
      return `Insert ${change.rowCount} row${change.rowCount > 1 ? 's' : ''} into ${tableNames}`
  }
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`
  return `'${String(value).replace(/'/g, "''")}'`
}

export function generateDeleteSQL(change: StagedChange): string {
  const statements: string[] = []

  for (const table of change.tables) {
    const qualifiedTable = table.schemaName
      ? `${escapeIdentifier(table.schemaName)}.${escapeIdentifier(table.tableName)}`
      : escapeIdentifier(table.tableName)

    // Determine which columns to use for WHERE clause
    const whereColumns = table.primaryKeyColumns.length > 0
      ? table.primaryKeyColumns
      : Object.keys(table.rows[0] || {})

    for (const row of table.rows) {
      const conditions = whereColumns
        .map(col => {
          const value = row[col]
          if (value === null || value === undefined) {
            return `${escapeIdentifier(col)} IS NULL`
          }
          return `${escapeIdentifier(col)} = ${escapeValue(value)}`
        })
        .join(' AND ')

      statements.push(`DELETE FROM ${qualifiedTable} WHERE ${conditions};`)
    }
  }

  return statements.join('\n')
}

export function createStagedDelete(
  selectedRows: Record<string, unknown>[],
  columns: ColumnMetadata[],
  rowIndices?: number[]
): StagedChange | null {
  // Group columns by table
  const tableColumns = new Map<string, ColumnMetadata[]>()

  for (const col of columns) {
    if (!col.tableName) continue // Skip computed columns

    const key = `${col.schemaName}.${col.tableName}`
    const existing = tableColumns.get(key) || []
    existing.push(col)
    tableColumns.set(key, existing)
  }

  if (tableColumns.size === 0) return null

  // Build table changes
  const tables: TableChange[] = []

  for (const [key, cols] of tableColumns) {
    const [schemaName, tableName] = key.split('.')
    const pkColumns = cols.filter(c => c.isPrimaryKey).map(c => c.name)
    const columnNames = cols.map(c => c.name)

    // Extract only columns belonging to this table from each row
    const tableRows = selectedRows.map(row => {
      const tableRow: Record<string, unknown> = {}
      for (const colName of columnNames) {
        tableRow[colName] = row[colName]
      }
      return tableRow
    })

    tables.push({
      tableName,
      schemaName,
      primaryKeyColumns: pkColumns,
      rows: tableRows,
    })
  }

  return {
    id: crypto.randomUUID(),
    type: 'delete',
    tables,
    rowCount: selectedRows.length,
    createdAt: new Date(),
    rowIndices,
  }
}

export function generateUpdateSQL(change: StagedChange): string {
  if (change.type !== 'update' || !change.originalRows) return ''

  const statements: string[] = []

  for (const table of change.tables) {
    const qualifiedTable = table.schemaName
      ? `${escapeIdentifier(table.schemaName)}.${escapeIdentifier(table.tableName)}`
      : escapeIdentifier(table.tableName)

    // Determine which columns to use for WHERE clause
    const whereColumns = table.primaryKeyColumns.length > 0
      ? table.primaryKeyColumns
      : Object.keys(table.rows[0] || {})

    for (let i = 0; i < table.rows.length; i++) {
      const updatedRow = table.rows[i]
      const originalRow = change.originalRows[i]

      // Find changed columns
      const changedColumns = Object.keys(updatedRow).filter(
        col => updatedRow[col] !== originalRow[col]
      )

      if (changedColumns.length === 0) continue

      // Build SET clause
      const setClause = changedColumns
        .map(col => `${escapeIdentifier(col)} = ${escapeValue(updatedRow[col])}`)
        .join(', ')

      // Build WHERE clause using original values
      const conditions = whereColumns
        .map(col => {
          const value = originalRow[col]
          if (value === null || value === undefined) {
            return `${escapeIdentifier(col)} IS NULL`
          }
          return `${escapeIdentifier(col)} = ${escapeValue(value)}`
        })
        .join(' AND ')

      statements.push(`UPDATE ${qualifiedTable} SET ${setClause} WHERE ${conditions};`)
    }
  }

  return statements.join('\n')
}

export function generateInsertSQL(change: StagedChange): string {
  if (change.type !== 'insert') return ''

  const statements: string[] = []

  for (const table of change.tables) {
    const qualifiedTable = table.schemaName
      ? `${escapeIdentifier(table.schemaName)}.${escapeIdentifier(table.tableName)}`
      : escapeIdentifier(table.tableName)

    for (const row of table.rows) {
      // Skip undefined values (they will use DEFAULT)
      const columnNames = Object.keys(row).filter(col => row[col] !== undefined)
      const columns = columnNames.map(col => escapeIdentifier(col)).join(', ')
      const values = columnNames.map(col => escapeValue(row[col])).join(', ')

      statements.push(`INSERT INTO ${qualifiedTable} (${columns}) VALUES (${values});`)
    }
  }

  return statements.join('\n')
}

export function createStagedInsert(
  rows: Record<string, unknown>[],
  columns: ColumnMetadata[]
): StagedChange | null {
  // Group columns by table
  const tableColumns = new Map<string, ColumnMetadata[]>()

  for (const col of columns) {
    if (!col.tableName) continue // Skip computed columns

    const key = `${col.schemaName}.${col.tableName}`
    const existing = tableColumns.get(key) || []
    existing.push(col)
    tableColumns.set(key, existing)
  }

  if (tableColumns.size === 0) return null

  // Build table changes
  const tables: TableChange[] = []

  for (const [key, cols] of tableColumns) {
    const [schemaName, tableName] = key.split('.')
    const pkColumns = cols.filter(c => c.isPrimaryKey).map(c => c.name)
    const columnNames = cols.map(c => c.name)

    // Extract only columns belonging to this table from each row
    const tableRows = rows.map(row => {
      const tableRow: Record<string, unknown> = {}
      for (const colName of columnNames) {
        tableRow[colName] = row[colName]
      }
      return tableRow
    })

    tables.push({
      tableName,
      schemaName,
      primaryKeyColumns: pkColumns,
      rows: tableRows,
    })
  }

  return {
    id: crypto.randomUUID(),
    type: 'insert',
    tables,
    rowCount: rows.length,
    createdAt: new Date(),
  }
}

export function createStagedUpdate(
  originalRow: Record<string, unknown>,
  updatedRow: Record<string, unknown>,
  columns: ColumnMetadata[],
  rowIndex?: number
): StagedChange | null {
  // Group columns by table
  const tableColumns = new Map<string, ColumnMetadata[]>()

  for (const col of columns) {
    if (!col.tableName) continue // Skip computed columns

    const key = `${col.schemaName}.${col.tableName}`
    const existing = tableColumns.get(key) || []
    existing.push(col)
    tableColumns.set(key, existing)
  }

  if (tableColumns.size === 0) return null

  // Check if there are any changes
  const hasChanges = columns.some(col => originalRow[col.name] !== updatedRow[col.name])
  if (!hasChanges) return null

  // Build table changes
  const tables: TableChange[] = []

  for (const [key, cols] of tableColumns) {
    const [schemaName, tableName] = key.split('.')
    const pkColumns = cols.filter(c => c.isPrimaryKey).map(c => c.name)
    const columnNames = cols.map(c => c.name)

    // Extract only CHANGED columns belonging to this table
    const tableRow: Record<string, unknown> = {}
    for (const colName of columnNames) {
      if (originalRow[colName] !== updatedRow[colName]) {
        tableRow[colName] = updatedRow[colName]
      }
    }

    // Only add table if it has changes
    if (Object.keys(tableRow).length > 0) {
      tables.push({
        tableName,
        schemaName,
        primaryKeyColumns: pkColumns,
        rows: [tableRow],
      })
    }
  }

  return {
    id: crypto.randomUUID(),
    type: 'update',
    tables,
    rowCount: 1,
    createdAt: new Date(),
    rowIndices: rowIndex !== undefined ? [rowIndex] : undefined,
    originalRows: [originalRow],
  }
}

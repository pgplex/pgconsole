import Papa from 'papaparse'
import type { ColumnMetadata } from '@/components/sql-editor/hooks/useEditorTabs'

function sanitizeCsvString(value: string): string {
  return /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function sanitizeCsvCell(value: unknown): unknown {
  return typeof value === 'string' ? sanitizeCsvString(value) : value
}

export function exportToCsv(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[],
  filename: string
) {
  const columnNames = columns.map((col) => col.name)
  const csv = Papa.unparse({
    fields: columnNames.map((name) => sanitizeCsvString(name)),
    data: rows.map((row) => columnNames.map((name) => sanitizeCsvCell(row[name]))),
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

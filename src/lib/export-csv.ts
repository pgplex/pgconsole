import Papa from 'papaparse'
import type { ColumnMetadata } from '@/components/sql-editor/hooks/useEditorTabs'

export function exportToCsv(
  columns: ColumnMetadata[],
  rows: Record<string, unknown>[],
  filename: string
) {
  const columnNames = columns.map((col) => col.name)
  const csv = Papa.unparse({
    fields: columnNames,
    data: rows.map((row) => columnNames.map((name) => row[name])),
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

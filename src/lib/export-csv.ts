import Papa from 'papaparse'
import type { ColumnMetadata } from '@/components/sql-editor/hooks/useEditorTabs'

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'markdown'

export const EXPORT_FORMATS: Array<{
  value: ExportFormat
  label: string
  extension: string
  mimeType: string
}> = [
  { value: 'csv', label: 'CSV', extension: 'csv', mimeType: 'text/csv;charset=utf-8;' },
  { value: 'tsv', label: 'TSV', extension: 'tsv', mimeType: 'text/tab-separated-values;charset=utf-8;' },
  { value: 'json', label: 'JSON', extension: 'json', mimeType: 'application/json;charset=utf-8;' },
  { value: 'markdown', label: 'Markdown', extension: 'md', mimeType: 'text/markdown;charset=utf-8;' },
]

function sanitizeCsvString(value: string): string {
  return /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function sanitizeCsvCell(value: unknown): unknown {
  return typeof value === 'string' ? sanitizeCsvString(value) : value
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  return value
}

function serializeDelimited(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[],
  delimiter: ',' | '\t'
): string {
  const columnNames = columns.map((col) => col.name)
  return Papa.unparse({
    fields: columnNames.map((name) => sanitizeCsvString(name)),
    data: rows.map((row) => columnNames.map((name) => sanitizeCsvCell(row[name]))),
  }, {
    delimiter,
  })
}

function serializeJson(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[]
): string {
  const columnNames = columns.map((col) => col.name)
  const projectedRows = rows.map((row) => Object.fromEntries(
    columnNames.map((name) => [name, normalizeJsonValue(row[name])])
  ))
  return `${JSON.stringify(projectedRows, null, 2)}\n`
}

function formatMarkdownCell(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function serializeMarkdown(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[]
): string {
  const columnNames = columns.map((col) => col.name)
  const lines = [
    `| ${columnNames.map(formatMarkdownCell).join(' | ')} |`,
    `| ${columnNames.map(() => '---').join(' | ')} |`,
  ]

  for (const row of rows) {
    lines.push(`| ${columnNames.map((name) => formatMarkdownCell(row[name])).join(' | ')} |`)
  }

  return `${lines.join('\n')}\n`
}

export function serializeExport(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[],
  format: ExportFormat
): string {
  switch (format) {
    case 'csv':
      return serializeDelimited(columns, rows, ',')
    case 'tsv':
      return serializeDelimited(columns, rows, '\t')
    case 'json':
      return serializeJson(columns, rows)
    case 'markdown':
      return serializeMarkdown(columns, rows)
  }
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportRows(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[],
  filename: string,
  format: ExportFormat
) {
  const exportFormat = EXPORT_FORMATS.find((item) => item.value === format)
  if (!exportFormat) return

  downloadText(serializeExport(columns, rows, format), filename, exportFormat.mimeType)
}

export function exportToCsv(
  columns: Array<Pick<ColumnMetadata, 'name'>>,
  rows: Record<string, unknown>[],
  filename: string
) {
  exportRows(columns, rows, filename, 'csv')
}

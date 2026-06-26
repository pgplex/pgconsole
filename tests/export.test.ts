import { describe, expect, it } from 'vitest'
import { serializeExport } from '../src/lib/export-csv'

const columns = [
  { name: 'id' },
  { name: 'name' },
  { name: 'note' },
]

const rows = [
  { id: 1, name: 'alpha', note: '=cmd' },
  { id: 2, name: 'pipe|name', note: 'line\nbreak' },
]

describe('serializeExport', () => {
  it('serializes CSV and sanitizes formula-like cells', () => {
    expect(serializeExport(columns, rows, 'csv')).toBe('id,name,note\r\n1,alpha,\'=cmd\r\n2,pipe|name,"line\nbreak"')
  })

  it('serializes TSV', () => {
    expect(serializeExport(columns, rows, 'tsv')).toBe('id\tname\tnote\r\n1\talpha\t\'=cmd\r\n2\tpipe|name\t"line\nbreak"')
  })

  it('serializes JSON with the selected column order', () => {
    expect(serializeExport(columns, [{ id: 1, name: undefined, note: 3n }], 'json')).toBe(`[
  {
    "id": 1,
    "name": null,
    "note": "3"
  }
]\n`)
  })

  it('serializes Markdown and escapes table pipes', () => {
    expect(serializeExport(columns, rows, 'markdown')).toBe([
      '| id | name | note |',
      '| --- | --- | --- |',
      '| 1 | alpha | =cmd |',
      '| 2 | pipe\\|name | line break |',
      '',
    ].join('\n'))
  })
})

import { describe, it, expect } from 'vitest'
import { buildExecutableSql, formatExecutionError } from '../server/lib/execute-sql'

describe('buildExecutableSql', () => {
  it('leaves a single statement untouched', () => {
    expect(buildExecutableSql('SELECT 1', { statementCount: 1, transactionSafe: true })).toBe('SELECT 1')
  })

  it('wraps a safe multi-statement batch in BEGIN/COMMIT', () => {
    const sql = 'INSERT INTO t VALUES (1);\nUPDATE t SET x = 2'
    expect(buildExecutableSql(sql, { statementCount: 2, transactionSafe: true })).toBe(`BEGIN;\n${sql}\n;\nCOMMIT;`)
  })

  it('does not wrap a multi-statement batch that is not transaction-safe', () => {
    const sql = 'VACUUM;\nSELECT 1'
    expect(buildExecutableSql(sql, { statementCount: 2, transactionSafe: false })).toBe(sql)
  })

  it('does not wrap a single transaction-unsafe statement', () => {
    expect(buildExecutableSql('VACUUM', { statementCount: 1, transactionSafe: false })).toBe('VACUUM')
  })
})

describe('formatExecutionError', () => {
  it('returns the bare message when there is no position/detail/hint', () => {
    expect(formatExecutionError(new Error('syntax error'), 'SELECT')).toBe('syntax error')
  })

  it('adds line context from the error position', () => {
    const sql = 'SELECT 1\nFROM nope\nWHERE x'
    // position points into line 2 (1-based char offset)
    const err = Object.assign(new Error('relation "nope" does not exist'), { position: '15' })
    const out = formatExecutionError(err, sql)
    expect(out).toContain('ERROR at Line 2:')
    expect(out).toContain('LINE 2: FROM nope')
  })

  it('appends DETAIL and HINT when present', () => {
    const err = Object.assign(new Error('boom'), { detail: 'the detail', hint: 'try this' })
    const out = formatExecutionError(err, 'SELECT 1')
    expect(out).toBe('boom\nDETAIL: the detail\nHINT: try this')
  })

  it('falls back for a non-Error throwable', () => {
    expect(formatExecutionError('weird', 'SELECT 1')).toBe('Query execution failed')
  })

  // Callers must pass the executed SQL (Postgres `position` indexes into what actually ran). For a
  // transaction-wrapped batch, BEGIN; is line 1, so the user's statements shift down by one.
  it('maps position onto the executed transaction-wrapped SQL', () => {
    const raw = 'INSERT INTO t VALUES (1);\nUPDATE nope SET x = 2'
    const executed = buildExecutableSql(raw, { statementCount: 2, transactionSafe: true })
    const pos = executed.indexOf('UPDATE') + 1 // 1-based offset into the executed string
    const err = Object.assign(new Error('relation "nope" does not exist'), { position: String(pos) })
    expect(formatExecutionError(err, executed)).toContain('LINE 3: UPDATE nope SET x = 2')
  })
})

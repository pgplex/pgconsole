import { describe, it, expect } from 'vitest'
import {
  detectRequiredPermissions,
  getRequiredPermission,
  extractFunctionsFromStatement,
  getFunctionPermission,
} from '../server/lib/sql-permissions'
import { parseSql } from '../src/lib/sql/core'

describe('getRequiredPermission', () => {
  it('returns read for SELECT statements', () => {
    expect(getRequiredPermission('select')).toBe('read')
    expect(getRequiredPermission('show')).toBe('read')
  })

  it('returns explain for EXPLAIN statements', () => {
    expect(getRequiredPermission('explain')).toBe('explain')
  })

  it('returns execute for CALL statements', () => {
    expect(getRequiredPermission('call')).toBe('execute')
  })

  it('returns write for DML statements', () => {
    expect(getRequiredPermission('insert')).toBe('write')
    expect(getRequiredPermission('update')).toBe('write')
    expect(getRequiredPermission('delete')).toBe('write')
    expect(getRequiredPermission('copy')).toBe('write')
  })

  it('returns ddl for DDL statements', () => {
    expect(getRequiredPermission('create_table')).toBe('ddl')
    expect(getRequiredPermission('alter_table')).toBe('ddl')
    expect(getRequiredPermission('drop')).toBe('ddl')
    expect(getRequiredPermission('create_index')).toBe('ddl')
    expect(getRequiredPermission('create_function')).toBe('ddl')
    expect(getRequiredPermission('grant')).toBe('ddl')
    expect(getRequiredPermission('revoke')).toBe('ddl')
  })

  it('returns admin for admin statements', () => {
    expect(getRequiredPermission('create_role')).toBe('admin')
    expect(getRequiredPermission('drop_role')).toBe('admin')
    expect(getRequiredPermission('create_db')).toBe('admin')
    expect(getRequiredPermission('drop_db')).toBe('admin')
    expect(getRequiredPermission('alter_system')).toBe('admin')
    expect(getRequiredPermission('unknown')).toBe('admin')
  })

  it('returns read for session control', () => {
    expect(getRequiredPermission('set')).toBe('read')
    expect(getRequiredPermission('transaction')).toBe('read')
    expect(getRequiredPermission('vacuum')).toBe('read')
  })
})

describe('getFunctionPermission', () => {
  it('returns admin for dangerous functions', () => {
    expect(getFunctionPermission('pg_cancel_backend')).toBe('admin')
    expect(getFunctionPermission('pg_terminate_backend')).toBe('admin')
  })

  it('returns read for regular functions', () => {
    expect(getFunctionPermission('now')).toBe('read')
    expect(getFunctionPermission('count')).toBe('read')
    expect(getFunctionPermission('upper')).toBe('read')
  })

  it('returns read for unknown functions', () => {
    expect(getFunctionPermission('my_custom_function')).toBe('read')
  })
})

describe('extractFunctionsFromStatement', () => {
  it('extracts functions from SELECT columns', async () => {
    const parsed = await parseSql('SELECT upper(name), count(*) FROM users')
    const functions = extractFunctionsFromStatement(parsed.statements[0])
    expect(functions).toContain('upper')
    expect(functions).toContain('count')
  })

  it('extracts functions from WHERE clause', async () => {
    const parsed = await parseSql('SELECT * FROM users WHERE lower(email) = $1')
    const functions = extractFunctionsFromStatement(parsed.statements[0])
    expect(functions).toContain('lower')
  })

  it('extracts nested functions', async () => {
    // coalesce is parsed as a special expression kind, not a function call
    const parsed = await parseSql('SELECT coalesce(upper(name), lower(fallback)) FROM users')
    const functions = extractFunctionsFromStatement(parsed.statements[0])
    expect(functions).toContain('upper')
    expect(functions).toContain('lower')
  })

  it('extracts functions from UPDATE assignments', async () => {
    const parsed = await parseSql('UPDATE users SET updated_at = now() WHERE id = 1')
    const functions = extractFunctionsFromStatement(parsed.statements[0])
    expect(functions).toContain('now')
  })

  it('extracts functions from INSERT values', async () => {
    const parsed = await parseSql("INSERT INTO logs (created_at) VALUES (now())")
    const functions = extractFunctionsFromStatement(parsed.statements[0])
    expect(functions).toContain('now')
  })
})

describe('detectRequiredPermissions', () => {
  it('returns read for simple SELECT', async () => {
    const { permissions } = await detectRequiredPermissions('SELECT * FROM users')
    expect(permissions).toEqual(new Set(['read']))
  })

  it('returns write for INSERT', async () => {
    const { permissions, transactionSafe } = await detectRequiredPermissions('INSERT INTO users (name) VALUES ($1)')
    expect(permissions).toEqual(new Set(['write']))
    expect(transactionSafe).toBe(true)
  })

  it('returns ddl for CREATE TABLE', async () => {
    const { permissions, transactionSafe } = await detectRequiredPermissions('CREATE TABLE foo (id int)')
    expect(permissions).toEqual(new Set(['ddl']))
    expect(transactionSafe).toBe(true)
  })

  it('returns admin for CREATE ROLE', async () => {
    const { permissions } = await detectRequiredPermissions('CREATE ROLE admin')
    expect(permissions).toEqual(new Set(['admin']))
  })

  it('returns read + admin for SELECT with pg_terminate_backend', async () => {
    const { permissions } = await detectRequiredPermissions('SELECT pg_terminate_backend(123)')
    expect(permissions).toEqual(new Set(['read', 'admin']))
  })

  it('returns write + admin for UPDATE with pg_cancel_backend', async () => {
    const { permissions } = await detectRequiredPermissions('UPDATE tasks SET cancelled = pg_cancel_backend(pid) WHERE id = 1')
    expect(permissions).toEqual(new Set(['write', 'admin']))
  })

  it('handles multi-statement SQL', async () => {
    const { permissions, transactionSafe } = await detectRequiredPermissions('SELECT 1; INSERT INTO foo VALUES (1); CREATE TABLE bar (id int)')
    expect(permissions).toEqual(new Set(['read', 'write', 'ddl']))
    expect(transactionSafe).toBe(true)
  })

  it('marks multi-statement DML as transactionSafe', async () => {
    const { permissions, transactionSafe, statementCount } = await detectRequiredPermissions('INSERT INTO a VALUES (1); DELETE FROM b WHERE id = 2; UPDATE c SET x = 1')
    expect(permissions).toEqual(new Set(['write']))
    expect(transactionSafe).toBe(true)
    expect(statementCount).toBe(3)
  })

  it('marks VACUUM as transaction-unsafe', async () => {
    const { transactionSafe } = await detectRequiredPermissions('VACUUM ANALYZE my_table')
    expect(transactionSafe).toBe(false)
  })

  it('marks CREATE DATABASE as transaction-unsafe', async () => {
    const { transactionSafe } = await detectRequiredPermissions('CREATE DATABASE mydb')
    expect(transactionSafe).toBe(false)
  })

  it('marks CREATE INDEX CONCURRENTLY as transaction-unsafe', async () => {
    const { transactionSafe } = await detectRequiredPermissions('CREATE INDEX CONCURRENTLY idx ON foo (bar)')
    expect(transactionSafe).toBe(false)
  })

  it('skips wrapping when SQL already has explicit transaction control', async () => {
    const { transactionSafe } = await detectRequiredPermissions('BEGIN; INSERT INTO a VALUES (1); COMMIT')
    expect(transactionSafe).toBe(false)
  })

  it('returns admin for unparseable SQL', async () => {
    const { permissions, transactionSafe } = await detectRequiredPermissions('THIS IS NOT VALID SQL !!!')
    expect(permissions).toEqual(new Set(['admin']))
    expect(transactionSafe).toBe(false)
  })

  it('returns read for empty SQL', async () => {
    const { permissions } = await detectRequiredPermissions('')
    expect(permissions).toEqual(new Set(['read']))
  })

  it('returns read for whitespace-only SQL', async () => {
    const { permissions } = await detectRequiredPermissions('   \n\t  ')
    expect(permissions).toEqual(new Set(['read']))
  })

  it('returns explain for EXPLAIN SELECT', async () => {
    const { permissions } = await detectRequiredPermissions('EXPLAIN SELECT 1')
    expect(permissions).toEqual(new Set(['explain']))
  })

  it('returns execute for CALL', async () => {
    const { permissions } = await detectRequiredPermissions('CALL my_proc()')
    expect(permissions).toEqual(new Set(['execute']))
  })

})

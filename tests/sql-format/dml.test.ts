import { describe, it, expect } from 'vitest'
import { formatSql } from '../../src/lib/sql/format'

describe('DELETE formatting', () => {
  it('formats simple DELETE', async () => {
    const sql = "DELETE FROM users WHERE id = 1"
    const result = await formatSql(sql)
    expect(result).toContain('DELETE FROM')
    expect(result).toContain('users')
    expect(result).toContain('WHERE')
    expect(result).toContain('id = 1')
  })

  it('formats DELETE with alias', async () => {
    const sql = "DELETE FROM users u WHERE u.id = 1"
    const result = await formatSql(sql)
    expect(result).toContain('users u')
  })

  it('formats DELETE with USING', async () => {
    const sql = "DELETE FROM users u USING orders o WHERE u.id = o.user_id"
    const result = await formatSql(sql)
    expect(result).toContain('USING')
    expect(result).toContain('orders o')
  })

  it('formats DELETE with RETURNING', async () => {
    const sql = "DELETE FROM users WHERE id = 1 RETURNING id, name"
    const result = await formatSql(sql)
    expect(result).toContain('RETURNING')
    expect(result).toContain('id')
    expect(result).toContain('name')
  })
})

describe('INSERT formatting', () => {
  it('formats simple INSERT', async () => {
    const sql = "INSERT INTO users (id, name) VALUES (1, 'John')"
    const result = await formatSql(sql)
    expect(result).toContain('INSERT INTO')
    expect(result).toContain('users (')
    expect(result).toContain('  id,')
    expect(result).toContain('  name')
    expect(result).toContain('VALUES (')
  })

  it('formats INSERT with multiple rows', async () => {
    const sql = "INSERT INTO users (id, name) VALUES (1, 'John'), (2, 'Jane')"
    const result = await formatSql(sql)
    expect(result).toContain('VALUES')
    expect(result).toContain("'John'")
    expect(result).toContain("'Jane'")
  })

  it('formats INSERT with RETURNING', async () => {
    const sql = "INSERT INTO users (name) VALUES ('John') RETURNING id"
    const result = await formatSql(sql)
    expect(result).toContain('RETURNING')
    expect(result).toContain('id')
  })

  it('formats INSERT from SELECT', async () => {
    const sql = "INSERT INTO users_backup SELECT * FROM users WHERE active = true"
    const result = await formatSql(sql)
    expect(result).toContain('INSERT INTO')
    expect(result).toContain('users_backup')
    expect(result).toContain('SELECT')
    expect(result).toContain('FROM')
    expect(result).toContain('users')
  })
})

describe('UPDATE formatting', () => {
  it('formats simple UPDATE', async () => {
    const sql = "UPDATE users SET name = 'Jane' WHERE id = 1"
    const result = await formatSql(sql)
    expect(result).toContain('UPDATE')
    expect(result).toContain('users')
    expect(result).toContain('SET')
    expect(result).toContain("name = 'Jane'")
    expect(result).toContain('WHERE')
    expect(result).toContain('id = 1')
  })

  it('formats UPDATE with multiple columns', async () => {
    const sql = "UPDATE users SET name = 'Jane', email = 'jane@example.com' WHERE id = 1"
    const result = await formatSql(sql)
    expect(result).toContain("name = 'Jane'")
    expect(result).toContain("email = 'jane@example.com'")
  })

  it('formats UPDATE with FROM', async () => {
    const sql = "UPDATE users u SET status = 'active' FROM orders o WHERE u.id = o.user_id"
    const result = await formatSql(sql)
    expect(result).toContain('FROM')
    expect(result).toContain('orders o')
  })

  it('formats UPDATE with RETURNING', async () => {
    const sql = "UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING *"
    const result = await formatSql(sql)
    expect(result).toContain('RETURNING')
  })
})

describe('mixed statements', () => {
  it('formats multiple DML statements', async () => {
    const sql = "DELETE FROM foo; INSERT INTO bar (x) VALUES (1); UPDATE baz SET y = 2"
    const result = await formatSql(sql)
    expect(result).toContain('DELETE FROM')
    expect(result).toContain('INSERT INTO')
    expect(result).toContain('UPDATE')
  })
})

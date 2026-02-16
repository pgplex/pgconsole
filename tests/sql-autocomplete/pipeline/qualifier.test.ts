import { describe, it, expect, beforeAll } from 'vitest'
import { autocomplete } from '../../../src/lib/sql/autocomplete/pipeline'
import { ensureModuleLoaded } from '../../../src/lib/sql/core'
import type { SchemaInfo } from '../../../src/lib/sql/autocomplete/types'

const mockSchema: SchemaInfo = {
  defaultSchema: 'public',
  tables: [
    {
      schema: 'public',
      name: 'users',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
  ],
  functions: [],
}

describe('Table qualifier insertText', () => {
  beforeAll(async () => {
    await ensureModuleLoaded()
  })

  it('should insert dot for tables in SELECT context', () => {
    const result = autocomplete('SELECT us', 9, mockSchema)
    expect(result.context.section).toBe('SELECT_COLUMNS')
    const usersSuggestion = result.suggestions.find(s => s.value === 'users')
    expect(usersSuggestion?.insertText).toBe('users.')
  })

  it('should not insert space for tables in FROM context', () => {
    const result = autocomplete('SELECT * FROM us', 16, mockSchema)
    expect(result.context.section).toBe('FROM_TABLE')
    const usersInFrom = result.suggestions.find(s => s.value === 'users')
    expect(usersInFrom?.insertText).toBeUndefined()
  })

  it('should insert dot for tables in WHERE context', () => {
    const result = autocomplete('SELECT * FROM users WHERE us', 28, mockSchema)
    expect(result.context.section).toBe('WHERE_CONDITION')
    const usersInWhere = result.suggestions.find(s => s.value === 'users')
    expect(usersInWhere?.insertText).toBe('users.')
  })

  it('should not insert space for tables in JOIN context', () => {
    const result = autocomplete('SELECT * FROM users JOIN us', 27, mockSchema)
    expect(result.context.section).toBe('JOIN_TABLE')
    const usersInJoin = result.suggestions.find(s => s.value === 'users')
    expect(usersInJoin?.insertText).toBeUndefined()
  })
})

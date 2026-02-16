// tests/sql-autocomplete/pipeline/tokenizer.test.ts

import { describe, it, expect, beforeAll } from 'vitest'
import {
  tokenize,
  getPartialToken,
  isInsideStringOrComment,
  getTokensUpToCursor,
} from '../../../src/lib/sql/autocomplete/tokenizer'
import { ensureModuleLoaded } from '../../../src/lib/sql/core'

// ============================================================================
// TEST CASE TYPES
// ============================================================================

interface TokenizeTestCase {
  name: string
  sql: string
  cursor: number
  expectToken?: { value: string; type: string }
  expectTokenCount?: number
}

interface CursorTestCase {
  name: string
  sql: string
  cursor: number
  expectedTokenIndex: number
  expectedPositionInToken?: number
}

interface PartialTokenTestCase {
  name: string
  sql: string
  cursor: number
  expected: string | null
}

interface StringCommentTestCase {
  name: string
  sql: string
  cursor: number
  expected: boolean
}

interface TokensUpToCursorTestCase {
  name: string
  sql: string
  cursor: number
  includeCurrent: boolean
  expectedCount: number
}

// ============================================================================
// TEST DATA
// ============================================================================

const tokenizeTests: TokenizeTestCase[] = [
  { name: 'tokenizes SELECT keyword', sql: 'SELECT id FROM users', cursor: 0, expectToken: { value: 'SELECT', type: 'keyword' } },
  { name: 'tokenizes identifier', sql: 'SELECT id FROM users', cursor: 0, expectToken: { value: 'id', type: 'identifier' } },
  { name: 'tokenizes punctuation', sql: 'SELECT id, name FROM users', cursor: 0, expectToken: { value: ',', type: 'punctuation' } },
  { name: 'tokenizes string literal', sql: "SELECT 'hello'", cursor: 0, expectToken: { value: "'hello'", type: 'literal' } },
  { name: 'tokenizes numeric literal', sql: 'SELECT 42', cursor: 0, expectToken: { value: '42', type: 'literal' } },
  { name: 'handles empty SQL', sql: '', cursor: 0, expectTokenCount: 0 },
  { name: 'handles whitespace-only SQL', sql: '   ', cursor: 0, expectTokenCount: 0 },
]

const cursorTests: CursorTestCase[] = [
  { name: 'cursor at start of token', sql: 'SELECT id', cursor: 7, expectedTokenIndex: 1, expectedPositionInToken: 0 },
  { name: 'cursor in middle of token', sql: 'SELECT', cursor: 3, expectedTokenIndex: 0, expectedPositionInToken: 3 },
  { name: 'cursor at end of token', sql: 'SELECT id', cursor: 6, expectedTokenIndex: 0, expectedPositionInToken: 6 },
  { name: 'cursor in gap between tokens', sql: 'SELECT   id', cursor: 8, expectedTokenIndex: 0 },
  { name: 'cursor after all tokens', sql: 'SELECT', cursor: 6, expectedTokenIndex: 0, expectedPositionInToken: 6 },
]

const partialTokenTests: PartialTokenTestCase[] = [
  { name: 'null at token boundary', sql: 'SELECT ', cursor: 7, expected: null },
  { name: 'partial when typing identifier', sql: 'SELECT us', cursor: 9, expected: 'us' },
  { name: 'full token at end of identifier', sql: 'SELECT users', cursor: 12, expected: 'users' },
  { name: 'null for keyword at end', sql: 'SELECT', cursor: 6, expected: null },
  { name: 'null after completed identifier with space', sql: 'SELECT col_bigint ', cursor: 18, expected: null },
  { name: 'null after table name with space', sql: 'SELECT col FROM users ', cursor: 22, expected: null },
]

const stringCommentTests: StringCommentTestCase[] = [
  { name: 'true inside unclosed string', sql: "SELECT 'hello", cursor: 10, expected: true },
  { name: 'false after closed string', sql: "SELECT 'hello'", cursor: 14, expected: false },
  { name: 'true inside comment', sql: 'SELECT -- comment', cursor: 14, expected: true },
  { name: 'false at statement start', sql: 'SELECT', cursor: 0, expected: false },
]

const tokensUpToCursorTests: TokensUpToCursorTestCase[] = [
  { name: 'all tokens up to cursor (inclusive)', sql: 'SELECT id FROM users', cursor: 14, includeCurrent: true, expectedCount: 3 },
  { name: 'excludes cursor token', sql: 'SELECT id FROM users', cursor: 14, includeCurrent: false, expectedCount: 2 },
  { name: 'handles empty tokenized result', sql: '', cursor: 0, includeCurrent: true, expectedCount: 0 },
]

// ============================================================================
// TEST RUNNER
// ============================================================================

describe('tokenizer', () => {
  beforeAll(async () => {
    await ensureModuleLoaded()
  })

  describe('tokenize', () => {
    for (const tc of tokenizeTests) {
      it(tc.name, () => {
        const result = tokenize(tc.sql, tc.cursor)

        if (tc.expectTokenCount !== undefined) {
          expect(result.tokens).toHaveLength(tc.expectTokenCount)
        }

        if (tc.expectToken) {
          const token = result.tokens.find((t) => t.value === tc.expectToken!.value)
          expect(token?.type, `Token "${tc.expectToken.value}" type`).toBe(tc.expectToken.type)
        }
      })
    }
  })

  describe('cursor position tracking', () => {
    for (const tc of cursorTests) {
      it(tc.name, () => {
        const result = tokenize(tc.sql, tc.cursor)
        expect(result.cursorTokenIndex).toBe(tc.expectedTokenIndex)
        if (tc.expectedPositionInToken !== undefined) {
          expect(result.cursorPositionInToken).toBe(tc.expectedPositionInToken)
        }
      })
    }
  })

  describe('getPartialToken', () => {
    for (const tc of partialTokenTests) {
      it(tc.name, () => {
        const tokenized = tokenize(tc.sql, tc.cursor)
        expect(getPartialToken(tokenized)).toBe(tc.expected)
      })
    }
  })

  describe('isInsideStringOrComment', () => {
    for (const tc of stringCommentTests) {
      it(tc.name, () => {
        const tokenized = tokenize(tc.sql, tc.cursor)
        expect(isInsideStringOrComment(tokenized, tc.cursor, tc.sql)).toBe(tc.expected)
      })
    }
  })

  describe('getTokensUpToCursor', () => {
    for (const tc of tokensUpToCursorTests) {
      it(tc.name, () => {
        const tokenized = tokenize(tc.sql, tc.cursor)
        const tokens = getTokensUpToCursor(tokenized, tc.includeCurrent)
        expect(tokens).toHaveLength(tc.expectedCount)
      })
    }
  })
})

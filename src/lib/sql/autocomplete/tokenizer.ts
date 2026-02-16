/**
 * SQL Tokenizer Module
 *
 * Uses @libpg-query/parser's scanSync for accurate PostgreSQL tokenization.
 * Converts tokens to a normalized format and tracks cursor position.
 */

import { scanSync as defaultScanSync } from '@libpg-query/parser'
import { isModuleLoaded as defaultIsModuleLoaded } from '../core'
import type { Token, TokenType, TokenizedSQL, ScanToken, PgQueryParser } from './types'

/**
 * Default parser implementation using @libpg-query/parser.
 */
const defaultParser: Pick<PgQueryParser, 'scanSync' | 'isLoaded'> = {
  scanSync: defaultScanSync,
  isLoaded: defaultIsModuleLoaded,
}

/**
 * Map libpg-query token to our TokenType
 */
function mapTokenType(token: ScanToken, text: string): TokenType {
  // Comments
  if (token.tokenName === 'SQL_COMMENT' || token.tokenName === 'C_COMMENT') {
    return 'comment'
  }

  // String literals
  if (
    token.tokenName === 'SCONST' ||
    token.tokenName === 'USCONST' ||
    token.tokenName === 'XCONST' ||
    token.tokenName === 'BCONST'
  ) {
    return 'literal'
  }

  // Numeric literals
  if (token.tokenName === 'ICONST' || token.tokenName === 'FCONST') {
    return 'literal'
  }

  // Operators - check BEFORE keywords because some operators (like '=') may have
  // keywordKind > 0 in certain contexts (e.g., UPDATE SET col = value)
  const operators = ['=', '<', '>', '!', '+', '-', '*', '/', '%', '^', '|', '&', '~', '@', '#']
  if (
    token.tokenName === 'Op' ||
    (text.length <= 2 && operators.some((op) => text.includes(op)))
  ) {
    return 'operator'
  }

  // Keywords (keywordKind > 0)
  if (token.keywordKind > 0) {
    return 'keyword'
  }

  // Identifiers
  if (token.tokenName === 'IDENT') {
    return 'identifier'
  }

  // Punctuation (parens, commas, dots, semicolons)
  const punctuation = ['(', ')', ',', '.', ';', '[', ']', '{', '}', ':']
  if (punctuation.includes(text)) {
    return 'punctuation'
  }

  // Whitespace - scanSync doesn't emit whitespace tokens, but just in case
  if (/^\s+$/.test(text)) {
    return 'whitespace'
  }

  // Default to identifier for unknown tokens
  return 'identifier'
}

/**
 * Options for tokenizer.
 */
export interface TokenizerOptions {
  /** Custom parser for testing */
  parser?: Pick<PgQueryParser, 'scanSync' | 'isLoaded'>
}

/**
 * Tokenize SQL string and track cursor position.
 *
 * @param sql - The SQL string to tokenize
 * @param cursorPosition - The cursor position (0-indexed character offset)
 * @param options - Optional configuration including custom parser for testing
 * @returns TokenizedSQL with tokens and cursor position info
 */
export function tokenize(
  sql: string,
  cursorPosition: number,
  options?: TokenizerOptions
): TokenizedSQL {
  const parser = options?.parser ?? defaultParser

  // Return empty result if module not loaded or empty SQL
  if (!parser.isLoaded() || !sql.trim()) {
    return {
      tokens: [],
      cursorTokenIndex: -1,
      cursorPositionInToken: 0,
      rawCursorPosition: cursorPosition,
    }
  }

  try {
    const result = parser.scanSync(sql)
    const tokens: Token[] = []

    for (const scanToken of result.tokens) {
      const text = sql.slice(scanToken.start, scanToken.end)
      tokens.push({
        type: mapTokenType(scanToken, text),
        value: text,
        start: scanToken.start,
        end: scanToken.end,
        keywordKind: scanToken.keywordKind > 0 ? scanToken.keywordKind : undefined,
      })
    }

    // Find cursor position in token list
    const { cursorTokenIndex, cursorPositionInToken } = findCursorPosition(
      tokens,
      cursorPosition
    )

    return {
      tokens,
      cursorTokenIndex,
      cursorPositionInToken,
      rawCursorPosition: cursorPosition,
    }
  } catch {
    // On scan error, return empty result
    return {
      tokens: [],
      cursorTokenIndex: -1,
      cursorPositionInToken: 0,
      rawCursorPosition: cursorPosition,
    }
  }
}

/**
 * Find which token the cursor is in and the position within that token.
 */
function findCursorPosition(
  tokens: Token[],
  cursorPosition: number
): { cursorTokenIndex: number; cursorPositionInToken: number } {
  if (tokens.length === 0) {
    return { cursorTokenIndex: -1, cursorPositionInToken: 0 }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Cursor is inside this token
    if (cursorPosition >= token.start && cursorPosition < token.end) {
      return {
        cursorTokenIndex: i,
        cursorPositionInToken: cursorPosition - token.start,
      }
    }

    // Cursor is exactly at the end of this token
    if (cursorPosition === token.end) {
      // Check if there's a next token that starts at cursor position
      if (i + 1 < tokens.length && tokens[i + 1].start === cursorPosition) {
        return {
          cursorTokenIndex: i + 1,
          cursorPositionInToken: 0,
        }
      }
      // Otherwise cursor is at end of this token
      return {
        cursorTokenIndex: i,
        cursorPositionInToken: token.value.length,
      }
    }

    // Cursor is in gap between tokens (whitespace)
    if (i + 1 < tokens.length && cursorPosition < tokens[i + 1].start) {
      // Return as "after" current token
      return {
        cursorTokenIndex: i,
        cursorPositionInToken: token.value.length,
      }
    }
  }

  // Cursor is after all tokens
  return {
    cursorTokenIndex: tokens.length - 1,
    cursorPositionInToken: tokens[tokens.length - 1].value.length,
  }
}

/**
 * Get tokens up to (and optionally including) cursor position.
 * Useful for context detection.
 */
export function getTokensUpToCursor(
  tokenized: TokenizedSQL,
  includeCursorToken: boolean = true
): Token[] {
  if (tokenized.cursorTokenIndex < 0) {
    return []
  }

  const endIndex = includeCursorToken
    ? tokenized.cursorTokenIndex + 1
    : tokenized.cursorTokenIndex

  return tokenized.tokens.slice(0, endIndex)
}

/**
 * Get the partial token text being typed at cursor position.
 * Returns null if cursor is at a token boundary or in whitespace after a token.
 */
export function getPartialToken(tokenized: TokenizedSQL): string | null {
  if (tokenized.cursorTokenIndex < 0) {
    return null
  }

  const token = tokenized.tokens[tokenized.cursorTokenIndex]
  if (!token) {
    return null
  }

  // If cursor is at the end of the token, check if it's truly at the boundary
  // or if there's whitespace between cursor and token end
  if (tokenized.cursorPositionInToken === token.value.length) {
    // If cursor is beyond token.end, it means cursor is in whitespace after the token
    // In this case, don't return a partial - the identifier is complete
    if (tokenized.rawCursorPosition > token.end) {
      return null
    }

    // Cursor is immediately at token boundary (no whitespace)
    // Only return as partial if it's an identifier being typed
    if (token.type === 'identifier') {
      return token.value
    }
    return null
  }

  // If cursor is in the middle of a token, return the partial
  if (tokenized.cursorPositionInToken > 0) {
    return token.value.slice(0, tokenized.cursorPositionInToken)
  }

  return null
}

/**
 * Check if cursor is inside a string literal or comment.
 * Also handles unclosed strings/comments by checking the raw SQL.
 */
export function isInsideStringOrComment(
  tokenized: TokenizedSQL,
  cursorPosition: number,
  sql?: string
): boolean {
  // If tokenization failed (empty tokens for non-empty SQL), check for unclosed quotes
  if (tokenized.tokens.length === 0 && sql && sql.trim()) {
    const sqlUpToCursor = sql.slice(0, cursorPosition)
    // Count unescaped single quotes - odd count means inside string
    const singleQuotes = (sqlUpToCursor.match(/'/g) || []).length
    const doubleQuotes = (sqlUpToCursor.match(/"/g) || []).length
    if (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1) {
      return true
    }
    // Check for unclosed block comment
    const blockCommentStart = sqlUpToCursor.lastIndexOf('/*')
    const blockCommentEnd = sqlUpToCursor.lastIndexOf('*/')
    if (blockCommentStart > blockCommentEnd) {
      return true
    }
  }

  if (tokenized.cursorTokenIndex < 0) {
    return false
  }

  const token = tokenized.tokens[tokenized.cursorTokenIndex]
  if (!token) {
    return false
  }

  // Check if we're inside (not at the end of) a string or comment
  if (token.type === 'literal' || token.type === 'comment') {
    // At the end of the token is OK (after closing quote/comment)
    if (cursorPosition < token.end) {
      return true
    }
  }

  // Check if cursor is at end of a line comment (includes everything to end of line)
  if (token.type === 'comment' && cursorPosition >= token.start && cursorPosition <= token.end) {
    return true
  }

  return false
}

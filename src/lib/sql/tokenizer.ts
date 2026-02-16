import { scanSync, type ScanToken } from '@libpg-query/parser'
import { isModuleLoaded } from './core'

export interface TokenRange {
  from: number
  to: number
  class: string
}

const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/g

// PostgreSQL type names that libpg-query classifies as IDENT instead of keywords
const PG_TYPE_NAMES = new Set([
  'SERIAL', 'SERIAL4', 'SERIAL8', 'BIGSERIAL', 'SMALLSERIAL',
  'INT2', 'INT4', 'INT8', 'FLOAT4', 'FLOAT8',
  'BOOL', 'TEXT', 'BYTEA', 'UUID', 'JSON', 'JSONB', 'XML', 'MONEY',
  'INET', 'CIDR', 'MACADDR', 'MACADDR8',
  'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
  'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE',
  'INT4MULTIRANGE', 'INT8MULTIRANGE', 'NUMMULTIRANGE', 'TSMULTIRANGE', 'TSTZMULTIRANGE', 'DATEMULTIRANGE',
  'TSVECTOR', 'TSQUERY',
  'OID', 'REGCLASS', 'REGTYPE', 'REGPROC', 'REGPROCEDURE', 'REGOPER', 'REGOPERATOR', 'REGCONFIG', 'REGDICTIONARY', 'REGNAMESPACE', 'REGROLE',
  'VOID', 'RECORD', 'TRIGGER', 'EVENT_TRIGGER', 'PG_LSN', 'PG_SNAPSHOT',
])

function mapTokenToClass(token: ScanToken, sql: string): string | null {
  switch (token.tokenName) {
    case 'SQL_COMMENT':
    case 'C_COMMENT':
      return 'pg-comment'
    case 'SCONST':
    case 'USCONST':
    case 'XCONST':
    case 'BCONST':
      return 'pg-string'
    case 'ICONST':
    case 'FCONST':
      return 'pg-number'
    case 'PARAM':
      return 'pg-param'
    case 'IDENT':
      if (PG_TYPE_NAMES.has(sql.slice(token.start, token.end).toUpperCase())) {
        return 'pg-type'
      }
      return null
  }

  switch (token.keywordKind) {
    case 4: // RESERVED_KEYWORD
    case 2: // COL_NAME_KEYWORD
      return 'pg-keyword'
    case 3: // TYPE_FUNC_NAME_KEYWORD
      return 'pg-type'
    case 1: // UNRESERVED_KEYWORD
      return 'pg-keyword-unreserved'
  }

  return null
}

function tokensToRanges(tokens: ScanToken[], sql: string): TokenRange[] {
  const ranges: TokenRange[] = []
  for (const token of tokens) {
    const tokenClass = mapTokenToClass(token, sql)
    if (tokenClass) {
      ranges.push({ from: token.start, to: token.end, class: tokenClass })
    }
  }
  return ranges
}

export function tokenize(sql: string): TokenRange[] {
  if (!isModuleLoaded() || !sql.trim()) {
    return []
  }

  try {
    return tokensToRanges(scanSync(sql).tokens, sql)
  } catch (err) {
    if (err instanceof SyntaxError && err.message.includes('control character')) {
      try {
        const sanitized = sql.replace(CONTROL_CHAR_REGEX, ' ')
        return tokensToRanges(scanSync(sanitized).tokens, sql)
      } catch {
        return []
      }
    }
    console.warn('SQL tokenizer error:', err)
    return []
  }
}

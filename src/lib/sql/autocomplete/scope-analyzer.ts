/**
 * Scope Analyzer Module
 *
 * Analyzes the SQL context to determine available tables, columns, and CTEs
 * that are in scope at the cursor position.
 */

import { parseSync as defaultParseSync } from '@libpg-query/parser'
import { isModuleLoaded as defaultIsModuleLoaded } from '../core'
import type {
  Token,
  TokenizedSQL,
  SyntaxTree,
  CursorContext,
  ScopeInfo,
  TableRef,
  ColumnRef,
  CTERef,
  SchemaInfo,
  SchemaTable,
  PgQueryParser,
} from './types'

/**
 * Default parser implementation using @libpg-query/parser.
 */
const defaultParser: Pick<PgQueryParser, 'parseSync' | 'isLoaded'> = {
  parseSync: defaultParseSync,
  isLoaded: defaultIsModuleLoaded,
}

/**
 * Options for scope analyzer.
 */
export interface ScopeAnalyzerOptions {
  /** Custom parser for testing */
  parser?: Pick<PgQueryParser, 'parseSync' | 'isLoaded'>
}

/**
 * Analyze scope to find available tables, columns, and CTEs.
 */
export function analyzeScope(
  _context: CursorContext,
  tokenized: TokenizedSQL,
  _tree: SyntaxTree,
  sql: string,
  schema: SchemaInfo,
  options?: ScopeAnalyzerOptions
): ScopeInfo {
  const parser = options?.parser ?? defaultParser
  const scopeInfo: ScopeInfo = {
    availableTables: [],
    availableColumns: [],
    ctes: [],
    resolvedColumns: new Map(),
    isPgQueryValid: false,
  }

  // Extract tables and aliases from tokens
  const tablesFromTokens = extractTablesFromTokens(tokenized, sql)
  scopeInfo.availableTables = tablesFromTokens

  // Extract CTEs if present
  const ctesFromTokens = extractCTEsFromTokens(tokenized, sql)
  scopeInfo.ctes = ctesFromTokens

  // Add CTE names as virtual tables
  for (const cte of ctesFromTokens) {
    scopeInfo.availableTables.push({
      name: cte.name,
      alias: null,
      schema: null,
      source: 'cte',
    })
  }

  // Try pg_query parsing for precise scope information
  const pgQueryResult = tryPgQueryParse(sql, parser)
  if (pgQueryResult.valid) {
    scopeInfo.isPgQueryValid = true
    // Merge pg_query results with token-based results
    mergePgQueryResults(scopeInfo, pgQueryResult, schema)
  }

  // Resolve columns for tables in scope
  resolveColumnsForTables(scopeInfo, schema)

  return scopeInfo
}

/**
 * Extract table references and aliases from tokens.
 */
function extractTablesFromTokens(tokenized: TokenizedSQL, _sql: string): TableRef[] {
  const tables: TableRef[] = []
  const tokens = tokenized.tokens

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prevToken = i > 0 ? tokens[i - 1] : null
    const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null
    const nextNextToken = i < tokens.length - 2 ? tokens[i + 2] : null

    const prevUpper = prevToken?.value?.toUpperCase()

    // Check if this is a table reference position
    if (prevUpper === 'FROM' || prevUpper === 'JOIN' || prevUpper === 'UPDATE') {
      if (token.type === 'identifier') {
        // Check for schema.table pattern
        if (nextToken?.value === '.' && nextNextToken?.type === 'identifier') {
          // Schema-qualified table
          const schemaName = token.value
          const tableName = nextNextToken.value

          // Look for alias after table name
          const aliasInfo = extractAlias(tokens, i + 2)

          tables.push({
            name: tableName,
            alias: aliasInfo.alias,
            schema: schemaName,
            source: prevUpper === 'JOIN' ? 'join' : 'from',
          })

          i = aliasInfo.endIndex - 1 // Skip processed tokens
        } else {
          // Unqualified table
          const aliasInfo = extractAlias(tokens, i)

          tables.push({
            name: token.value,
            alias: aliasInfo.alias,
            schema: null,
            source: prevUpper === 'JOIN' ? 'join' : 'from',
          })

          i = aliasInfo.endIndex - 1
        }
      }
    }

    // Handle INSERT INTO
    if (prevUpper === 'INTO' && token.type === 'identifier') {
      const aliasInfo = extractAlias(tokens, i)
      tables.push({
        name: token.value,
        alias: aliasInfo.alias,
        schema: null,
        source: 'from',
      })
      i = aliasInfo.endIndex - 1
    }

    // Handle comma-separated tables in FROM clause
    if (token.value === ',' && isInFromClause(tokens, i)) {
      if (nextToken?.type === 'identifier') {
        const aliasInfo = extractAlias(tokens, i + 1)
        tables.push({
          name: nextToken.value,
          alias: aliasInfo.alias,
          schema: null,
          source: 'from',
        })
        i = aliasInfo.endIndex - 1
      }
    }
  }

  return tables
}

/**
 * Extract alias for a table at a given token index.
 */
function extractAlias(tokens: Token[], tableIndex: number): { alias: string | null; endIndex: number } {
  const nextIndex = tableIndex + 1
  const nextToken = tokens[nextIndex]
  const nextNextToken = tokens[nextIndex + 1]

  if (!nextToken) {
    return { alias: null, endIndex: tableIndex + 1 }
  }

  // Pattern: table AS alias
  if (nextToken.value?.toUpperCase() === 'AS' && nextNextToken?.type === 'identifier') {
    return { alias: nextNextToken.value, endIndex: nextIndex + 2 }
  }

  // Pattern: table alias (identifier right after table, not a keyword or clause starter)
  if (nextToken.type === 'identifier') {
    const upper = nextToken.value.toUpperCase()
    // Don't treat clause keywords as aliases
    const clauseKeywords = ['WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL', 'SET', 'VALUES']
    if (!clauseKeywords.includes(upper)) {
      return { alias: nextToken.value, endIndex: nextIndex + 1 }
    }
  }

  return { alias: null, endIndex: tableIndex + 1 }
}

/**
 * Check if a position is within a FROM clause.
 */
function isInFromClause(tokens: Token[], index: number): boolean {
  // Look backwards for FROM
  let parenDepth = 0
  for (let i = index - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token.value === ')') parenDepth++
    if (token.value === '(') parenDepth--

    if (parenDepth === 0 && token.type === 'keyword') {
      const upper = token.value.toUpperCase()
      if (upper === 'FROM') return true
      if (['WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'SELECT'].includes(upper)) return false
    }
  }
  return false
}

/**
 * Extract CTEs from WITH clause.
 */
function extractCTEsFromTokens(tokenized: TokenizedSQL, _sql: string): CTERef[] {
  const ctes: CTERef[] = []
  const tokens = tokenized.tokens

  // Check if starts with WITH
  if (tokens.length === 0 || tokens[0].value.toUpperCase() !== 'WITH') {
    return ctes
  }

  let i = 1
  // Skip RECURSIVE if present
  if (tokens[i]?.value?.toUpperCase() === 'RECURSIVE') {
    i++
  }

  while (i < tokens.length) {
    const token = tokens[i]

    // CTE name
    if (token.type === 'identifier') {
      const cteName = token.value
      const columns: string[] = []

      i++

      // Check for column list: cte_name (col1, col2)
      if (tokens[i]?.value === '(') {
        i++ // skip (
        while (i < tokens.length && tokens[i].value !== ')') {
          if (tokens[i].type === 'identifier') {
            columns.push(tokens[i].value)
          }
          i++
        }
        i++ // skip )
      }

      // Skip to AS
      while (i < tokens.length && tokens[i].value?.toUpperCase() !== 'AS') {
        i++
      }
      i++ // skip AS

      // Skip the CTE query (handle nested parens)
      if (tokens[i]?.value === '(') {
        let parenDepth = 1
        i++
        while (i < tokens.length && parenDepth > 0) {
          if (tokens[i].value === '(') parenDepth++
          if (tokens[i].value === ')') parenDepth--
          i++
        }
      }

      ctes.push({ name: cteName, columns })

      // Check for comma (more CTEs) or main query
      if (tokens[i]?.value === ',') {
        i++
        continue
      }

      // Hit main query
      break
    }

    i++
  }

  return ctes
}

/**
 * Try to parse SQL with pg_query for precise information.
 */
interface PgQueryResult {
  valid: boolean
  tables: { schema: string | null; name: string; alias: string | null }[]
  columns: { table: string | null; column: string }[]
}

function tryPgQueryParse(
  sql: string,
  parser: Pick<PgQueryParser, 'parseSync' | 'isLoaded'>
): PgQueryResult {
  if (!parser.isLoaded()) {
    return { valid: false, tables: [], columns: [] }
  }

  try {
    const result = parser.parseSync(sql)
    const tables: PgQueryResult['tables'] = []
    const columns: PgQueryResult['columns'] = []

    // Walk the AST to extract tables and columns
    extractFromPgQueryAST(result, tables, columns)

    return { valid: true, tables, columns }
  } catch {
    return { valid: false, tables: [], columns: [] }
  }
}

/**
 * Extract tables and columns from pg_query AST.
 */
function extractFromPgQueryAST(
  node: unknown,
  tables: PgQueryResult['tables'],
  columns: PgQueryResult['columns']
): void {
  if (!node || typeof node !== 'object') return

  const obj = node as Record<string, unknown>

  // Extract RangeVar (table references)
  if ('RangeVar' in obj) {
    const rv = obj.RangeVar as Record<string, unknown>
    const alias = rv.alias as Record<string, unknown> | undefined
    tables.push({
      schema: (rv.schemaname as string) || null,
      name: rv.relname as string,
      alias: (alias?.aliasname as string) || null,
    })
  }

  // Extract ColumnRef
  if ('ColumnRef' in obj) {
    const cr = obj.ColumnRef as Record<string, unknown>
    const fields = cr.fields as unknown[]
    if (fields) {
      const parts = fields.map((f) => {
        const field = f as Record<string, unknown>
        if ('String' in field) return (field.String as { sval: string }).sval
        if ('A_Star' in field) return '*'
        return ''
      })

      if (parts.length === 1) {
        columns.push({ table: null, column: parts[0] })
      } else if (parts.length === 2) {
        columns.push({ table: parts[0], column: parts[1] })
      }
    }
  }

  // Recurse into all properties
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        extractFromPgQueryAST(item, tables, columns)
      }
    } else if (typeof value === 'object' && value !== null) {
      extractFromPgQueryAST(value, tables, columns)
    }
  }
}

/**
 * Merge pg_query results into scope info.
 */
function mergePgQueryResults(
  scopeInfo: ScopeInfo,
  pgQueryResult: PgQueryResult,
  _schema: SchemaInfo
): void {
  // Add any tables from pg_query not found in token analysis
  for (const pgTable of pgQueryResult.tables) {
    const exists = scopeInfo.availableTables.some(
      (t) =>
        t.name.toLowerCase() === pgTable.name.toLowerCase() &&
        (t.alias?.toLowerCase() === pgTable.alias?.toLowerCase() || (!t.alias && !pgTable.alias))
    )

    if (!exists) {
      scopeInfo.availableTables.push({
        name: pgTable.name,
        alias: pgTable.alias,
        schema: pgTable.schema,
        source: 'from',
      })
    }
  }
}

/**
 * Resolve columns for all tables in scope using schema information.
 */
function resolveColumnsForTables(scopeInfo: ScopeInfo, schema: SchemaInfo): void {
  for (const tableRef of scopeInfo.availableTables) {
    // Find table in schema
    const schemaTable = findTableInSchema(tableRef, schema)

    if (schemaTable) {
      const columns: ColumnRef[] = schemaTable.columns.map((col) => ({
        name: col.name,
        table: tableRef.alias || tableRef.name,
        type: col.type,
        nullable: col.nullable,
      }))

      scopeInfo.resolvedColumns.set(tableRef.alias || tableRef.name, columns)
      scopeInfo.availableColumns.push(...columns)
    }

    // Handle CTEs - columns might be explicitly defined
    const cte = scopeInfo.ctes.find((c) => c.name.toLowerCase() === tableRef.name.toLowerCase())
    if (cte && cte.columns.length > 0) {
      const columns: ColumnRef[] = cte.columns.map((colName) => ({
        name: colName,
        table: tableRef.alias || tableRef.name,
        type: null,
        nullable: true,
      }))

      scopeInfo.resolvedColumns.set(tableRef.alias || tableRef.name, columns)
      scopeInfo.availableColumns.push(...columns)
    }
  }
}

/**
 * Find a table in the schema by name or TableRef.
 * Handles both qualified names (schema.table) and unqualified names.
 *
 * @param nameOrRef - Table name string (possibly qualified) or TableRef object
 * @param schema - Schema information
 * @returns The matching SchemaTable or undefined
 */
export function findTableInSchema(
  nameOrRef: string | TableRef,
  schema: SchemaInfo
): SchemaTable | undefined {
  // Normalize input to name and schema parts
  let tableName: string
  let schemaName: string | null

  if (typeof nameOrRef === 'string') {
    // Handle qualified name: "schema.table"
    if (nameOrRef.includes('.')) {
      const [schemaPart, tablePart] = nameOrRef.split('.')
      schemaName = schemaPart
      tableName = tablePart
    } else {
      schemaName = null
      tableName = nameOrRef
    }
  } else {
    // TableRef object
    schemaName = nameOrRef.schema
    tableName = nameOrRef.name
  }

  const nameLower = tableName.toLowerCase()
  const schemaLower = schemaName?.toLowerCase()

  // If schema specified, match exactly
  if (schemaLower) {
    return schema.tables.find(
      (t) => t.schema.toLowerCase() === schemaLower && t.name.toLowerCase() === nameLower
    )
  }

  // Otherwise, prefer defaultSchema
  const defaultMatch = schema.tables.find(
    (t) => t.schema === schema.defaultSchema && t.name.toLowerCase() === nameLower
  )
  if (defaultMatch) return defaultMatch

  // Fall back to any schema
  return schema.tables.find((t) => t.name.toLowerCase() === nameLower)
}

/**
 * Resolve an alias to its table name.
 */
export function resolveAlias(scopeInfo: ScopeInfo, alias: string): string | null {
  const aliasLower = alias.toLowerCase()

  for (const tableRef of scopeInfo.availableTables) {
    if (tableRef.alias?.toLowerCase() === aliasLower) {
      return tableRef.name
    }
  }

  return null
}

/**
 * Get columns for a specific table or alias.
 */
export function getColumnsForTable(
  scopeInfo: ScopeInfo,
  tableOrAlias: string
): ColumnRef[] {
  const key = tableOrAlias.toLowerCase()

  // Check resolved columns
  for (const [name, columns] of scopeInfo.resolvedColumns) {
    if (name.toLowerCase() === key) {
      return columns
    }
  }

  // Try resolving alias
  const tableName = resolveAlias(scopeInfo, tableOrAlias)
  if (tableName) {
    for (const [name, columns] of scopeInfo.resolvedColumns) {
      if (name.toLowerCase() === tableName.toLowerCase()) {
        return columns
      }
    }
  }

  return []
}

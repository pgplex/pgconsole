/**
 * Candidate Generator Module
 *
 * Generates autocomplete candidates based on cursor context and scope.
 * Different sections produce different candidate types.
 */

import type {
  CursorContext,
  ScopeInfo,
  SchemaInfo,
  Candidate,
  CandidateType,
  SQLSection,
} from './types'
import { getColumnsForTable, findTableInSchema } from './scope-analyzer'
import {
  getAllKeywords,
  getStatementKeywords,
  getOrderByModifiers,
  getGroupByKeywords,
  getExpressionKeywords,
} from '../completions'
import { PG_SYSTEM_FUNCTIONS } from '../pg-system-functions'

// ============================================================================
// INSERT TEXT RULES
// ============================================================================

/**
 * Keywords that should be followed by an opening parenthesis.
 * These are function-like keywords that take arguments.
 */
const PAREN_KEYWORDS = new Set([
  'ROLLUP',
  'CUBE',
  'GROUPING SETS',
  'CAST',
  'EXTRACT',
  'SUBSTRING',
  'TRIM',
  'POSITION',
  'OVERLAY',
  'COALESCE',
  'NULLIF',
  'GREATEST',
  'LEAST',
  'XMLELEMENT',
  'XMLFOREST',
  'XMLROOT',
  'XMLPARSE',
  'XMLSERIALIZE',
])

/**
 * Keywords that should NOT have trailing whitespace.
 * These are typically used inline or at end of expressions.
 */
const NO_SPACE_KEYWORDS = new Set([
  'END',      // CASE...END has no trailing space needed
  'TRUE',     // Boolean literals
  'FALSE',
  'NULL',
])

/**
 * Sections where keywords should NOT have trailing whitespace.
 * Data types in CREATE TABLE don't need space - user may add (n) for sized types or constraints.
 */
const NO_SPACE_KEYWORD_SECTIONS = new Set<SQLSection>([
  'CREATE_TABLE_COLUMN_TYPE',
])

// Sections where tables are used as qualifiers (table.column access)
// In these contexts, selecting a table should insert a dot, not a space
const TABLE_QUALIFIER_SECTIONS = new Set<SQLSection>([
  'SELECT_COLUMNS',
  'WHERE_CONDITION',
  'JOIN_CONDITION',
  'HAVING',
  'GROUP_BY',
  'ORDER_BY',
])

/**
 * Get the insert text for a candidate.
 * Centralizes all whitespace/punctuation insertion logic.
 *
 * Rules:
 * - Functions: add opening paren `(`
 * - Function-like keywords (ROLLUP, CAST, etc.): add opening paren `(`
 * - Tables, CTEs, most keywords: add trailing space ` `
 * - Columns in WHERE/JOIN_CONDITION/HAVING: add trailing space (operator follows)
 * - Columns in other contexts: no modification (comma, AS, etc. may follow)
 * - Special keywords (END, TRUE, FALSE, NULL): no trailing space
 */
export function getInsertText(
  type: CandidateType,
  value: string,
  section?: SQLSection
): string | undefined {
  switch (type) {
    case 'function':
      // Functions always get opening paren
      return value + '('

    case 'keyword':
      // Check for function-like keywords
      if (PAREN_KEYWORDS.has(value.toUpperCase())) {
        return value + '('
      }
      // Check for keywords that don't need trailing space
      if (NO_SPACE_KEYWORDS.has(value.toUpperCase())) {
        return undefined // Use value as-is
      }
      // Check for sections where keywords shouldn't have trailing space
      // e.g., data types in CREATE TABLE - user may add (n) or constraints
      if (section && NO_SPACE_KEYWORD_SECTIONS.has(section)) {
        return undefined // Use value as-is
      }
      // Most keywords get trailing space
      return value + ' '

    case 'table':
    case 'view':
    case 'cte':
      // In expression contexts, tables are qualifiers for column access
      // Insert a dot to trigger column autocomplete
      if (section && TABLE_QUALIFIER_SECTIONS.has(section)) {
        return value + '.'
      }
      // No trailing space — user may want alias, semicolon, or newline
      return undefined

    case 'column':
      // No trailing space — user may want comma, semicolon, operator, etc.
      return undefined

    case 'alias':
    case 'schema':
    case 'operator':
      // No automatic insertion - context varies too much
      return undefined
  }
}

/**
 * Create a candidate with proper insertText.
 */
function createCandidate(
  type: CandidateType,
  value: string,
  source: Candidate['source'],
  detail?: string,
  section?: SQLSection
): Candidate {
  return {
    type,
    value,
    displayText: value,
    detail,
    insertText: getInsertText(type, value, section),
    source,
  }
}

/**
 * Generate autocomplete candidates based on context and scope.
 */
export function generateCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const { section, tablePrefix } = context

  // Handle table.column prefix
  if (tablePrefix) {
    return generateColumnCandidatesForTable(tablePrefix, scope, schema)
  }

  // Handle incomplete compound keywords FIRST - these take priority over isAfterNot
  // because IS NOT is different from standalone NOT
  switch (section) {
    case 'ORDER_BY_INCOMPLETE':
    case 'GROUP_BY_INCOMPLETE':
      return [createCandidate('keyword', 'BY', 'keyword')]

    case 'IS_INCOMPLETE':
      return [
        createCandidate('keyword', 'NULL', 'keyword'),
        createCandidate('keyword', 'NOT NULL', 'keyword'),
        createCandidate('keyword', 'TRUE', 'keyword'),
        createCandidate('keyword', 'NOT TRUE', 'keyword'),
        createCandidate('keyword', 'FALSE', 'keyword'),
        createCandidate('keyword', 'NOT FALSE', 'keyword'),
        createCandidate('keyword', 'UNKNOWN', 'keyword'),
        createCandidate('keyword', 'NOT UNKNOWN', 'keyword'),
        createCandidate('keyword', 'DISTINCT FROM', 'keyword'),
        createCandidate('keyword', 'NOT DISTINCT FROM', 'keyword'),
      ]

    case 'IS_NOT_INCOMPLETE':
      return [
        createCandidate('keyword', 'NULL', 'keyword'),
        createCandidate('keyword', 'TRUE', 'keyword'),
        createCandidate('keyword', 'FALSE', 'keyword'),
        createCandidate('keyword', 'UNKNOWN', 'keyword'),
        createCandidate('keyword', 'DISTINCT FROM', 'keyword'),
      ]

    case 'NULLS_INCOMPLETE':
      return [
        createCandidate('keyword', 'FIRST', 'keyword'),
        createCandidate('keyword', 'LAST', 'keyword'),
      ]

    case 'INSERT_VALUES':
      // After INSERT INTO table (columns), suggest VALUES, SELECT, or OVERRIDING
      return [
        createCandidate('keyword', 'VALUES', 'keyword'),
        createCandidate('keyword', 'SELECT', 'keyword'),
        createCandidate('keyword', 'OVERRIDING USER VALUE', 'keyword'),
        createCandidate('keyword', 'OVERRIDING SYSTEM VALUE', 'keyword'),
      ]
  }

  // Handle NOT keyword - suggest operators that can follow NOT
  // This takes priority for standalone NOT (not IS NOT)
  if (context.isAfterNot) {
    return generateNotFollowKeywords()
  }

  // Generate candidates based on section
  switch (section) {
    case 'STATEMENT_START':
      return generateStatementStartCandidates()

    case 'SELECT_COLUMNS':
      return generateSelectColumnCandidates(context, scope, schema)

    case 'FROM_TABLE':
      return generateFromTableCandidates(scope, schema, context)

    case 'JOIN_TABLE':
    case 'INSERT_TABLE':
      return generateTableCandidates(scope, schema)

    case 'DELETE_TABLE':
      return generateDeleteTableCandidates(context, scope, schema)

    case 'UPDATE_TABLE':
      return generateUpdateTableCandidates(context, scope, schema)

    case 'CALL_PROCEDURE':
      return generateProcedureCandidates(schema)

    case 'WHERE_CONDITION':
    case 'JOIN_CONDITION':
    case 'HAVING':
      return generateExpressionCandidates(context, scope, schema)

    case 'GROUP_BY':
      return generateGroupByCandidates(context, scope, schema)

    case 'ORDER_BY':
      return generateOrderByCandidates(context, scope, schema)

    case 'UPDATE_SET':
      return generateUpdateSetCandidates(context, scope, schema)

    case 'RETURNING':
      return generateReturningCandidates(scope, schema)

    case 'CREATE_OBJECT':
      return generateCreateObjectCandidates()

    case 'CREATE_TABLE_NAME':
      return [] // User is naming the table, no suggestions

    case 'CREATE_TABLE_COLUMNS':
      return generateCreateTableColumnsCandidates()

    case 'CREATE_TABLE_COLUMN_TYPE':
      return generateColumnTypeCandidates(section)

    case 'CREATE_TABLE_COLUMN_CONSTRAINT':
      return generateColumnConstraintCandidates()

    case 'CREATE_TABLE_OPTIONS':
      return generateCreateTableOptionsCandidates()

    case 'WITH_CTE_NAME':
      return [] // User is naming the CTE, no suggestions

    case 'LIMIT':
    case 'OFFSET':
      return [] // Expects numeric literal

    case 'UNKNOWN':
      return [] // No suggestions - waiting for word break

    default:
      return generateDefaultCandidates(scope, schema)
  }
}

/**
 * Generate candidates for statement start (SELECT, INSERT, etc.).
 */
function generateStatementStartCandidates(): Candidate[] {
  return getStatementKeywords().map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate candidates for SELECT column list.
 *
 * Context-aware behavior:
 * - After comma (SELECT xxx,): suggest expression candidates (columns, functions, tables)
 * - After completed identifier with whitespace (SELECT xxx ): suggest only clause transitions
 * - Otherwise: suggest all candidates with priority columns > functions > keywords > tables
 */
function generateSelectColumnCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const candidates: Candidate[] = []

  // After completed identifier with whitespace (no comma):
  // User likely wants clause transition keywords, not more expressions
  if (context.isAfterCompletedIdentifier) {
    return generateSelectClauseTransitionCandidates()
  }

  // After comma or in other expression contexts: suggest expression candidates

  // 1. Columns from tables in scope (highest priority)
  candidates.push(...generateColumnCandidates(scope, schema))

  // 2. Columns from selected table (even if not in FROM clause yet)
  // This helps users who are looking at a table in the sidebar
  if (schema.selectedTable) {
    candidates.push(...generateSelectedTableColumnCandidates(schema))
  }

  // 3. SQL functions (commonly used in SELECT)
  candidates.push(...generateFunctionCandidates(schema))
  // 3b. System functions
  candidates.push(...generateSystemFunctionCandidates(schema.pgVersion))

  // 4. Expression-building keywords (CASE, DISTINCT, etc.)
  candidates.push(...generateSelectKeywordCandidates())

  // 5. Clause transition keywords (FROM, WHERE, etc.) - lower priority
  // These are valid when user has finished typing a column/expression
  candidates.push(...generateSelectClauseTransitionCandidates())

  // 6. Tables (for table.column access) - lowest priority
  // In SELECT context, tables are qualifiers so they get a dot
  candidates.push(...generateTableCandidates(scope, schema, 'SELECT_COLUMNS'))

  return candidates
}

/**
 * Generate column candidates from the selected table in the sidebar.
 */
function generateSelectedTableColumnCandidates(schema: SchemaInfo): Candidate[] {
  if (!schema.selectedTable) return []

  const selectedTable = schema.tables.find(
    t => t.schema === schema.selectedTable!.schema && t.name === schema.selectedTable!.name
  )

  if (!selectedTable) return []

  return selectedTable.columns.map(col => ({
    type: 'column' as CandidateType,
    value: col.name,
    displayText: col.name,
    detail: `${schema.selectedTable!.name}.${col.type}`,
    source: 'schema' as const,
  }))
}

/**
 * Generate column candidates from scope.
 */
function generateColumnCandidates(
  scope: ScopeInfo,
  _schema: SchemaInfo,
  section?: SQLSection
): Candidate[] {
  const candidates: Candidate[] = []
  const seenColumns = new Set<string>()

  // Columns from tables in scope
  for (const col of scope.availableColumns) {
    const key = `${col.table || ''}.${col.name}`.toLowerCase()
    if (seenColumns.has(key)) continue
    seenColumns.add(key)

    candidates.push({
      type: 'column',
      value: col.name,
      displayText: col.name,
      detail: col.table ? `${col.table}.${col.type || 'unknown'}` : col.type || undefined,
      insertText: getInsertText('column', col.name, section),
      source: 'context',
    })
  }

  return candidates
}

/**
 * Generate column candidates for a specific table prefix (table.column).
 */
function generateColumnCandidatesForTable(
  tablePrefix: string,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const columns = getColumnsForTable(scope, tablePrefix)

  if (columns.length > 0) {
    return columns.map((col) => ({
      type: 'column' as CandidateType,
      value: col.name,
      displayText: col.name,
      detail: col.type ? `${col.type}${col.nullable === false ? ' NOT NULL' : ''}` : undefined,
      source: 'context',
    }))
  }

  // Table not in scope - try to find it in schema
  const schemaTable = findTableInSchema(tablePrefix, schema)
  if (schemaTable) {
    return schemaTable.columns.map((col) => ({
      type: 'column' as CandidateType,
      value: col.name,
      displayText: col.name,
      detail: `${col.type}${col.nullable ? '' : ' NOT NULL'}`,
      source: 'schema',
    }))
  }

  return []
}

/**
 * Generate candidates for FROM clause.
 * Includes tables and clause transition keywords (WHERE, JOIN, etc.)
 */
function generateFromTableCandidates(scope: ScopeInfo, schema: SchemaInfo, _context: CursorContext): Candidate[] {
  const candidates: Candidate[] = []

  // 1. Tables (primary suggestions)
  candidates.push(...generateTableCandidates(scope, schema))

  // 2. Clause transition keywords (WHERE, JOIN, ORDER BY, etc.)
  // These are always available as the user may have finished the table name
  candidates.push(...generateFromClauseTransitionCandidates())

  return candidates
}

/**
 * Generate clause transition keywords for FROM context.
 * These appear after table names are complete.
 */
function generateFromClauseTransitionCandidates(): Candidate[] {
  const clauseKeywords = [
    'WHERE',
    'JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'ON',
    'GROUP BY',
    'HAVING',
    'ORDER BY',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
  ]

  return clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate table candidates.
 */
function generateTableCandidates(scope: ScopeInfo, schema: SchemaInfo, section?: SQLSection): Candidate[] {
  const candidates: Candidate[] = []
  const seenTables = new Set<string>()

  // CTEs first (highest priority in context)
  for (const cte of scope.ctes) {
    const key = cte.name.toLowerCase()
    if (seenTables.has(key)) continue
    seenTables.add(key)

    candidates.push({
      type: 'cte',
      value: cte.name,
      displayText: cte.name,
      detail: 'CTE',
      insertText: getInsertText('cte', cte.name, section),
      source: 'context',
    })
  }

  // Tables from schema
  for (const table of schema.tables) {
    const isDefault = table.schema === schema.defaultSchema
    const qualifiedName = `${table.schema}.${table.name}`
    const displayName = isDefault ? table.name : qualifiedName

    const key = qualifiedName.toLowerCase()
    if (seenTables.has(key)) continue
    seenTables.add(key)

    const type: CandidateType = table.type === 'view' ? 'view' : 'table'
    candidates.push({
      type,
      value: displayName,
      displayText: displayName,
      detail: isDefault ? undefined : table.schema,
      insertText: getInsertText(type, displayName, section),
      source: 'schema',
    })
  }

  return candidates
}

/**
 * Generate expression candidates (for WHERE, HAVING, etc.).
 *
 * Context-aware behavior:
 * - Typing operator (WHERE col <): suggest operator completions (<= , <>)
 * - After NOT keyword (WHERE col NOT ): suggest IN, LIKE, BETWEEN, etc.
 * - After completed identifier with whitespace (WHERE col ): suggest operators and logical keywords
 * - After operator (WHERE col = ): suggest columns, functions, values
 * - After logical keyword (WHERE col = 1 AND ): suggest columns
 */
function generateExpressionCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const candidates: Candidate[] = []

  // User is typing an operator that could be extended (e.g., < → <= or <>)
  if (context.isTypingOperator && context.partialOperator) {
    return generateOperatorCompletions(context.partialOperator)
  }

  // After NOT keyword: suggest operators that can follow NOT
  if (context.isAfterNot) {
    return generateNotFollowKeywords()
  }

  // After completed expression (expr op expr): suggest AND/OR and clause transitions
  // e.g., "WHERE col = val |" should suggest AND, OR, ORDER BY, etc.
  if (context.isAfterCompletedExpression) {
    // Logical connectors (AND, OR) - highest priority
    candidates.push(...generateLogicalConnectorCandidates())
    // Clause transitions (ORDER BY, GROUP BY, etc.)
    candidates.push(...generateWhereClauseTransitionCandidates())
    // For UPDATE/DELETE, also suggest RETURNING
    if (context.statementType === 'UPDATE' || context.statementType === 'DELETE') {
      candidates.push(createCandidate('keyword', 'RETURNING', 'keyword'))
    }
    return candidates
  }

  // After completed identifier with whitespace (no operator):
  // User likely wants operators (=, <>, LIKE, IN, IS NULL, etc.)
  if (context.isAfterCompletedIdentifier) {
    // Comparison operators
    candidates.push(...generateComparisonOperatorCandidates())
    // Expression keywords (IN, BETWEEN, LIKE, IS NULL, etc.) and logical (AND, OR)
    candidates.push(...generateExpressionKeywordCandidates())
    // Clause transitions (ORDER BY, GROUP BY, etc.) for when expression is complete
    candidates.push(...generateWhereClauseTransitionCandidates())
    // For UPDATE/DELETE, also suggest RETURNING
    if (context.statementType === 'UPDATE' || context.statementType === 'DELETE') {
      candidates.push(createCandidate('keyword', 'RETURNING', 'keyword'))
    }
    return candidates
  }

  // Default: suggest all expression elements

  // 1. Columns (with trailing space since operator typically follows)
  candidates.push(...generateColumnCandidates(scope, schema, context.section))

  // 2. Functions
  candidates.push(...generateFunctionCandidates(schema))
  // 2b. System functions
  candidates.push(...generateSystemFunctionCandidates(schema.pgVersion))

  // 3. Expression keywords (AND, OR, IN, etc.)
  candidates.push(...generateExpressionKeywordCandidates())

  // 4. Tables (for table.column access)
  // In expression contexts, tables are qualifiers so they get a dot
  candidates.push(...generateTableCandidates(scope, schema, context.section))

  return candidates
}

/**
 * Generate keywords that can follow NOT in expressions.
 * e.g., NOT IN, NOT LIKE, NOT BETWEEN, NOT ILIKE, NOT SIMILAR TO, NOT EXISTS
 */
function generateNotFollowKeywords(): Candidate[] {
  const keywords = ['IN', 'LIKE', 'ILIKE', 'BETWEEN', 'SIMILAR TO', 'EXISTS', 'NULL']
  return keywords.map(kw => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate comparison operator candidates (=, <>, <, >, <=, >=).
 */
function generateComparisonOperatorCandidates(): Candidate[] {
  const operators = ['=', '<>', '!=', '<', '>', '<=', '>=']
  return operators.map(op => ({
    type: 'operator' as CandidateType,
    value: op,
    displayText: op,
    insertText: op + ' ',
    source: 'keyword' as const,
  }))
}

/**
 * Generate operator completions for a partial operator.
 * e.g., "<" can complete to "<=", "<>", or stay as "<"
 */
function generateOperatorCompletions(partial: string): Candidate[] {
  // Map of partial operators to their possible completions
  const completions: Record<string, string[]> = {
    '<': ['<=', '<>', '<'],
    '>': ['>=', '>'],
    '!': ['!='],
  }

  const ops = completions[partial] || [partial]
  return ops.map(op => ({
    type: 'operator' as CandidateType,
    value: op,
    displayText: op,
    // For completions, we only insert what's remaining after the partial
    insertText: op.slice(partial.length) + ' ',
    source: 'keyword' as const,
  }))
}

/**
 * Generate clause transition keywords for WHERE/HAVING context.
 * These appear after expressions are complete.
 */
function generateWhereClauseTransitionCandidates(): Candidate[] {
  const clauseKeywords = [
    'ORDER BY',
    'GROUP BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
  ]
  return clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate logical connector keywords (AND, OR).
 * These appear after a completed comparison expression.
 */
function generateLogicalConnectorCandidates(): Candidate[] {
  return ['AND', 'OR'].map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate candidates for UPDATE table context.
 * After table name, suggests SET; otherwise suggests tables.
 */
function generateUpdateTableCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  if (context.isAfterCompletedIdentifier || context.isAfterCompletedExpression) {
    return [createCandidate('keyword', 'SET', 'keyword')]
  }
  return generateTableCandidates(scope, schema)
}

/**
 * Generate candidates for DELETE FROM table context.
 * After table name, suggests USING/WHERE/RETURNING; otherwise suggests tables.
 */
function generateDeleteTableCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  if (context.isAfterCompletedIdentifier || context.isAfterCompletedExpression) {
    return ['USING', 'WHERE', 'RETURNING'].map(kw => createCandidate('keyword', kw, 'keyword'))
  }
  return generateTableCandidates(scope, schema)
}

/**
 * Generate candidates for UPDATE SET clause.
 * After assignment, suggests WHERE/FROM/RETURNING; otherwise suggests columns/functions.
 */
function generateUpdateSetCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  if (context.isAfterCompletedExpression || context.isAfterCompletedIdentifier) {
    return ['WHERE', 'FROM', 'RETURNING'].map(kw => createCandidate('keyword', kw, 'keyword'))
  }
  return [
    ...generateColumnCandidates(scope, schema),
    ...generateFunctionCandidates(schema),
    ...generateSystemFunctionCandidates(schema.pgVersion),
  ]
}

/**
 * Generate candidates for RETURNING clause.
 * Suggests columns, functions, and tables for qualified access.
 */
function generateReturningCandidates(scope: ScopeInfo, schema: SchemaInfo): Candidate[] {
  return [
    ...generateColumnCandidates(scope, schema),
    ...generateFunctionCandidates(schema),
    ...generateSystemFunctionCandidates(schema.pgVersion),
    ...generateTableCandidates(scope, schema),
  ]
}

/**
 * Generate candidates for ORDER BY clause.
 * Includes columns, functions, and ORDER BY modifiers (ASC, DESC, NULLS FIRST/LAST).
 */
function generateOrderByCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const candidates: Candidate[] = []

  // After ORDER BY modifier (ASC, DESC, NULLS FIRST/LAST): show clause transitions and comma
  // e.g., "ORDER BY col ASC |" should suggest NULLS, LIMIT, comma for next column
  if (context.isAfterOrderByModifier) {
    // Suggest NULLS FIRST/LAST (if not already specified - checking this would require more context)
    // For simplicity, always include them - user can skip if already used
    candidates.push(createCandidate('keyword', 'NULLS FIRST', 'keyword'))
    candidates.push(createCandidate('keyword', 'NULLS LAST', 'keyword'))
    // Clause transitions (LIMIT, OFFSET, etc.)
    const clauseKeywords = ['LIMIT', 'OFFSET', 'FOR UPDATE', 'FOR SHARE', 'UNION', 'INTERSECT', 'EXCEPT']
    candidates.push(...clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword')))
    return candidates
  }

  // After completed column/expression: show modifiers and clause transitions
  // e.g., "ORDER BY col |" should suggest ASC, DESC, LIMIT, etc.
  if (context.isAfterCompletedExpression || context.isAfterCompletedIdentifier) {
    // ORDER BY modifiers (ASC, DESC, NULLS FIRST, NULLS LAST)
    candidates.push(...generateOrderByModifierCandidates())
    // Clause transitions (LIMIT, OFFSET, etc.)
    const clauseKeywords = ['LIMIT', 'OFFSET', 'FOR UPDATE', 'FOR SHARE', 'UNION', 'INTERSECT', 'EXCEPT']
    candidates.push(...clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword')))
    return candidates
  }

  // Default: suggest columns, functions, modifiers

  // 1. Columns (most common in ORDER BY)
  candidates.push(...generateColumnCandidates(scope, schema))

  // 2. Functions (for expressions like ORDER BY lower(name))
  candidates.push(...generateFunctionCandidates(schema))
  // 2b. System functions
  candidates.push(...generateSystemFunctionCandidates(schema.pgVersion))

  // 3. ORDER BY modifiers (ASC, DESC, NULLS FIRST, NULLS LAST)
  candidates.push(...generateOrderByModifierCandidates())

  // 4. Clause transitions (LIMIT, OFFSET, etc.) - lower priority
  const clauseKeywords = ['LIMIT', 'OFFSET', 'FOR UPDATE', 'FOR SHARE']
  candidates.push(...clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword')))

  return candidates
}

/**
 * Generate candidates for GROUP BY clause.
 * Includes columns, functions, and GROUP BY advanced keywords (ROLLUP, CUBE, GROUPING SETS).
 */
function generateGroupByCandidates(
  context: CursorContext,
  scope: ScopeInfo,
  schema: SchemaInfo
): Candidate[] {
  const candidates: Candidate[] = []

  // After completed column/expression: show clause transitions only
  // e.g., "GROUP BY col |" should suggest HAVING, ORDER BY, etc.
  if (context.isAfterCompletedExpression || context.isAfterCompletedIdentifier) {
    const clauseKeywords = ['HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'WINDOW', 'UNION', 'INTERSECT', 'EXCEPT']
    return clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
  }

  // Default: suggest columns and GROUP BY keywords

  // 1. Columns (most common in GROUP BY)
  candidates.push(...generateColumnCandidates(scope, schema))
  // 1b. Functions (for GROUP BY date_trunc(...))
  candidates.push(...generateFunctionCandidates(schema))
  candidates.push(...generateSystemFunctionCandidates(schema.pgVersion))

  // 2. Advanced GROUP BY keywords (ROLLUP, CUBE, GROUPING SETS)
  candidates.push(...generateGroupByKeywordCandidates())

  // 3. Clause transitions (HAVING, ORDER BY, LIMIT, etc.) - lower priority
  const clauseKeywords = ['HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'WINDOW']
  candidates.push(...clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword')))

  return candidates
}

/**
 * Generate keywords relevant in SELECT column context.
 * Focus on expression-building keywords, not clause transitions.
 */
function generateSelectKeywordCandidates(): Candidate[] {
  // Keywords that help build SELECT expressions
  // Note: FROM, WHERE, ORDER BY etc. are clause transitions that are
  // suggested via next-clause logic, not mixed with column suggestions
  const selectKeywords = [
    'DISTINCT',
    'ALL',
    'AS',
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    'CAST',
    'NULL',
    'TRUE',
    'FALSE',
    'AND',
    'OR',
    'NOT',
  ]

  return selectKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate clause transition keywords for SELECT context.
 * These appear after column expressions are complete.
 */
function generateSelectClauseTransitionCandidates(): Candidate[] {
  const clauseKeywords = [
    'FROM',
    'WHERE',
    'GROUP BY',
    'HAVING',
    'ORDER BY',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
    'WINDOW',
  ]

  return clauseKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate keywords relevant in expression context (WHERE, HAVING, ON).
 */
function generateExpressionKeywordCandidates(): Candidate[] {
  return getExpressionKeywords().map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate ORDER BY modifier keywords (ASC, DESC, NULLS FIRST, etc.).
 */
function generateOrderByModifierCandidates(): Candidate[] {
  return getOrderByModifiers().map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate GROUP BY advanced keywords (ROLLUP, CUBE, GROUPING SETS).
 */
function generateGroupByKeywordCandidates(): Candidate[] {
  return getGroupByKeywords().map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate function candidates from schema.
 * Excludes procedures (kind === 'procedure'). Functions with undefined kind are included.
 */
function generateFunctionCandidates(schema: SchemaInfo): Candidate[] {
  return schema.functions
    .filter((fn) => fn.kind === undefined || fn.kind === 'function')
    .map((fn) => {
      const detail = fn.signature ? `(${fn.signature})` : '()'
      return createCandidate('function', fn.name, 'schema', detail)
    })
}

/**
 * Generate procedure candidates from schema (for CALL statement).
 */
function generateProcedureCandidates(schema: SchemaInfo): Candidate[] {
  return schema.functions
    .filter((fn) => fn.kind === 'procedure')
    .map((fn) => {
      const detail = fn.signature ? `(${fn.signature})` : '()'
      return createCandidate('procedure', fn.name, 'schema', detail)
    })
}

/**
 * Generate system function candidates from static data.
 * Filters by PostgreSQL version to exclude functions not available in older versions.
 *
 * @param pgVersion - Target PostgreSQL version. Defaults to 14 (oldest supported version)
 *                    when not specified, ensuring broad compatibility.
 */
function generateSystemFunctionCandidates(pgVersion: number = 14): Candidate[] {
  return PG_SYSTEM_FUNCTIONS
    .filter(fn => {
      // Exclude functions not available in the target version
      if (fn.minVersion && pgVersion < fn.minVersion) return false
      return true
    })
    .map(fn => {
      const sig = fn.signatures[0]
      const detail = sig ? `(${sig.args || ''}) → ${sig.returnType}` : '()'
      return createCandidate('function', fn.name, 'system', detail)
    })
}

/**
 * Generate candidates for CREATE object type (TABLE, INDEX, VIEW, etc.).
 */
function generateCreateObjectCandidates(): Candidate[] {
  const objectTypes = [
    'TABLE', 'TEMP TABLE', 'UNLOGGED TABLE', 'TABLE IF NOT EXISTS',
    'INDEX', 'UNIQUE INDEX', 'INDEX CONCURRENTLY',
    'VIEW', 'OR REPLACE VIEW', 'MATERIALIZED VIEW',
    'FUNCTION', 'OR REPLACE FUNCTION', 'PROCEDURE', 'OR REPLACE PROCEDURE',
    'TRIGGER', 'SCHEMA', 'DATABASE', 'SEQUENCE', 'TYPE', 'DOMAIN',
    'EXTENSION', 'EXTENSION IF NOT EXISTS',
    'ROLE', 'USER', 'POLICY', 'PUBLICATION', 'SUBSCRIPTION',
  ]
  return objectTypes.map((name) => createCandidate('keyword', name, 'keyword'))
}

/**
 * Generate candidates for CREATE TABLE column definition start.
 * Suggests table-level constraint keywords when starting a new element.
 */
function generateCreateTableColumnsCandidates(): Candidate[] {
  // When starting a new column/constraint in CREATE TABLE (...),
  // user can either type a column name (no suggestions) or a table constraint keyword
  const tableConstraintKeywords = [
    'CONSTRAINT',
    'PRIMARY KEY',
    'UNIQUE',
    'FOREIGN KEY',
    'CHECK',
    'EXCLUDE',
    'LIKE',
  ]
  return tableConstraintKeywords.map((kw) => createCandidate('keyword', kw, 'keyword'))
}

/**
 * Generate PostgreSQL data type candidates for column definitions.
 */
function generateColumnTypeCandidates(section: SQLSection): Candidate[] {
  const dataTypes = [
    // Common types first
    'INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
    'VARCHAR', 'TEXT', 'CHAR', 'BOOLEAN', 'BOOL',
    'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'INTERVAL',
    'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION',
    'UUID', 'JSON', 'JSONB', 'BYTEA',
    // Less common types
    'MONEY', 'XML', 'INET', 'CIDR', 'MACADDR',
    'POINT', 'LINE', 'BOX', 'CIRCLE', 'POLYGON',
    'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE',
    'TSVECTOR', 'TSQUERY',
  ]
  return dataTypes.map((name) => createCandidate('keyword', name, 'keyword', undefined, section))
}

/**
 * Generate column constraint candidates for CREATE TABLE.
 */
function generateColumnConstraintCandidates(): Candidate[] {
  const constraints = [
    'NOT NULL', 'NULL', 'DEFAULT', 'PRIMARY KEY', 'UNIQUE',
    'REFERENCES', 'CHECK', 'CONSTRAINT', 'COLLATE',
    'GENERATED ALWAYS AS', 'GENERATED BY DEFAULT AS IDENTITY', 'GENERATED ALWAYS AS IDENTITY',
    'DEFERRABLE', 'NOT DEFERRABLE', 'INITIALLY DEFERRED', 'INITIALLY IMMEDIATE',
  ]
  return constraints.map((name) => createCandidate('keyword', name, 'keyword'))
}

/**
 * Generate CREATE TABLE options candidates (after column list).
 */
function generateCreateTableOptionsCandidates(): Candidate[] {
  const options = [
    'INHERITS', 'PARTITION BY', 'PARTITION BY RANGE', 'PARTITION BY LIST', 'PARTITION BY HASH',
    'USING', 'WITH', 'WITHOUT OIDS', 'TABLESPACE',
    'ON COMMIT DELETE ROWS', 'ON COMMIT PRESERVE ROWS', 'ON COMMIT DROP',
  ]
  return options.map((name) => createCandidate('keyword', name, 'keyword'))
}

/**
 * Generate default candidates when section is unknown.
 */
function generateDefaultCandidates(scope: ScopeInfo, schema: SchemaInfo): Candidate[] {
  const candidates: Candidate[] = []

  // Mix of everything
  candidates.push(...generateColumnCandidates(scope, schema))
  candidates.push(...generateFunctionCandidates(schema))
  candidates.push(...generateSystemFunctionCandidates(schema.pgVersion))
  candidates.push(...getAllKeywords().map((kw) => createCandidate('keyword', kw, 'keyword')))
  candidates.push(...generateTableCandidates(scope, schema))

  return candidates
}


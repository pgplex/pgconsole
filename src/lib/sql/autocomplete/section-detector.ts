/**
 * Section Detector Module
 *
 * Determines the SQL section (clause) where the cursor is positioned.
 * Uses both token analysis and syntax tree structure.
 */

import type {
  Token,
  TokenizedSQL,
  SyntaxTree,
  SyntaxNode,
  CursorContext,
  SQLSection,
  StatementType,
} from './types'
import { getTokensUpToCursor, getPartialToken, isInsideStringOrComment } from './tokenizer'
import { findClauseAtPosition, findStatementAtPosition } from './parser'

// Keywords that typically start table contexts
const TABLE_PRECEDING_KEYWORDS = ['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE']

// Common PostgreSQL data types (for CREATE TABLE column type detection)
const PG_DATA_TYPES = new Set([
  'SMALLINT', 'INTEGER', 'INT', 'BIGINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE', 'SERIAL', 'BIGSERIAL',
  'CHAR', 'VARCHAR', 'TEXT', 'BYTEA', 'BOOLEAN', 'BOOL',
  'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'INTERVAL',
  'UUID', 'JSON', 'JSONB', 'XML', 'MONEY',
  'INET', 'CIDR', 'MACADDR', 'POINT', 'BOX', 'CIRCLE', 'POLYGON',
  'TSVECTOR', 'TSQUERY', 'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'DATERANGE',
])
const JOIN_KEYWORDS = ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL']

// Statement-starting keywords (used to detect if a keyword could be a prefix of a statement)
const STATEMENT_KEYWORDS = [
  'SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'WITH', 'CALL',
  'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'EXPLAIN', 'ANALYZE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'GRANT', 'REVOKE',
]

// Keywords that typically start expression/column contexts
const EXPRESSION_KEYWORDS = [
  'SELECT',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'ON',
  'HAVING',
  'WHEN',
  'THEN',
  'ELSE',
  'SET',
  'CASE',
]


/**
 * Detect the SQL section and context at cursor position.
 */
export function detectSection(
  tokenized: TokenizedSQL,
  tree: SyntaxTree,
  cursorPosition: number,
  sql: string
): CursorContext {
  // Check if inside string or comment - no completions
  if (isInsideStringOrComment(tokenized, cursorPosition)) {
    return createContext('UNKNOWN', 'UNKNOWN', {
      containingNode: null,
      partialToken: null,
    })
  }

  const tokensUpToCursor = getTokensUpToCursor(tokenized, true)
  const partialToken = getPartialToken(tokenized)

  // Empty or at start
  if (tokensUpToCursor.length === 0) {
    // Only suggest if there's explicit content (whitespace counts as word break)
    const hasContent = sql.slice(0, cursorPosition).trim().length === 0
    if (hasContent) {
      return createContext('STATEMENT_START', 'UNKNOWN', {
        isAtKeywordBoundary: true,
        partialToken,
      })
    }
  }

  // Only a partial identifier being typed with no prior keywords = statement start
  // e.g., user just typed "S" for "SELECT"
  if (tokensUpToCursor.length === 1 && tokensUpToCursor[0].type === 'identifier') {
    return createContext('STATEMENT_START', 'UNKNOWN', {
      isAtKeywordBoundary: false,
      partialToken,
    })
  }

  // Single keyword token that could be a prefix of a statement keyword = statement start
  // e.g., user typed "IN" which could be the start of "INSERT INTO"
  // This handles cases where the partial input happens to be a valid SQL keyword
  if (tokensUpToCursor.length === 1 && tokensUpToCursor[0].type === 'keyword') {
    const keywordValue = tokensUpToCursor[0].value.toUpperCase()
    // Check if this keyword could be the beginning of a statement keyword
    const couldBeStatementPrefix = STATEMENT_KEYWORDS.some(
      stmt => stmt.toUpperCase().startsWith(keywordValue)
    )
    if (couldBeStatementPrefix && cursorPosition === tokensUpToCursor[0].end) {
      return createContext('STATEMENT_START', 'UNKNOWN', {
        isAtKeywordBoundary: false,
        partialToken: keywordValue,
      })
    }
  }

  // Check if user is typing a keyword that could be part of a function name (e.g., "JSON" for "JSON_AGG")
  // This happens when cursor is at the end of a keyword token with no space after
  const currentToken = tokensUpToCursor[tokensUpToCursor.length - 1]
  const isTypingKeywordAsIdentifier = currentToken?.type === 'keyword' &&
    cursorPosition === currentToken.end  // Cursor immediately after keyword, no space

  // General rule: only show suggestions after explicit word break (whitespace/newline)
  // Exceptions:
  // - After "." for table.column completion
  // - After "(" for CREATE TABLE column list and function calls
  // - When typing a keyword that could be part of an identifier (e.g., JSON for JSON_AGG)
  // If cursor is immediately after a token with no space, don't suggest unless typing partial
  if (tokensUpToCursor.length > 0 && !partialToken && !isTypingKeywordAsIdentifier) {
    const lastToken = tokensUpToCursor[tokensUpToCursor.length - 1]
    const hasWordBreak = cursorPosition > lastToken.end
    const isDotCompletion = lastToken.value === '.'
    const isOpenParenCompletion = lastToken.value === '('
    if (!hasWordBreak && !isDotCompletion && !isOpenParenCompletion) {
      // Cursor right after token, no word break - no suggestions
      return createContext('UNKNOWN', 'UNKNOWN', {
        containingNode: null,
        partialToken: null,
      })
    }
  }

  // If typing a keyword as identifier, use the previous keyword for context detection
  // and pass the keyword value as the partial token
  // e.g., "HAVING col = 1 OR|" - OR is a keyword but user might want ORDER BY
  if (isTypingKeywordAsIdentifier && tokensUpToCursor.length > 1) {
    const tokensWithoutLast = tokensUpToCursor.slice(0, -1)
    const effectivePartialToken = currentToken.value

    // Find the previous real keyword for context
    const prevKeyword = findLastKeyword(tokensWithoutLast)
    const clauseNode = findClauseAtPosition(tree, cursorPosition)
    const statementNode = findStatementAtPosition(tree, cursorPosition)
    const statementType = detectStatementType(statementNode)

    const section = determineSectionFromContext(
      clauseNode,
      prevKeyword,
      false, // not after keyword boundary (we're typing)
      false, // not after comma
      tokensWithoutLast,
      sql
    )

    // Check if we're after a completed expression (e.g., "col = 1 OR|")
    // Look at the token before the keyword we're typing
    const contextToken = tokensWithoutLast[tokensWithoutLast.length - 1]
    const isContextTokenValue = contextToken?.type === 'identifier' || contextToken?.type === 'literal'
    const isAfterCompletedExpr = isContextTokenValue && hasComparisonBeforeLastToken(tokensWithoutLast)

    // Check if we're after a completed identifier (no comparison operator before)
    // e.g., "ORDER BY col AS|" - contextToken is 'col' (identifier), no operator before
    const isAfterCompletedIdent = isContextTokenValue &&
      !isAfterCompletedExpr &&
      contextToken?.type === 'identifier'

    return createContext(section, statementType, {
      isAtKeywordBoundary: false,
      isAfterComma: false,
      isAfterOperator: false,
      isAfterCompletedExpression: isAfterCompletedExpr,
      isAfterCompletedIdentifier: isAfterCompletedIdent,
      partialToken: effectivePartialToken,
      tablePrefix: null,
      depth: calculateSubqueryDepth(tokensUpToCursor),
      containingNode: clauseNode,
    })
  }

  // Find the clause containing cursor from the syntax tree
  const clauseNode = findClauseAtPosition(tree, cursorPosition)
  const statementNode = findStatementAtPosition(tree, cursorPosition)
  const statementType = detectStatementType(statementNode)

  // Analyze tokens to determine exact context
  const lastTokens = tokensUpToCursor.slice(-5) // Look at last 5 tokens
  const lastToken = lastTokens[lastTokens.length - 1]
  const prevToken = lastTokens.length > 1 ? lastTokens[lastTokens.length - 2] : null

  // Check for table.column pattern (identifier followed by dot)
  if (lastToken?.value === '.') {
    const identToken = prevToken
    if (identToken?.type === 'identifier') {
      const section = detectSectionFromClause(clauseNode)
      return createContext(section, statementType, {
        tablePrefix: identToken.value,
        containingNode: clauseNode,
        partialToken: null,
      })
    }
  }

  // Check for statement start after semicolon
  if (lastToken?.value === ';') {
    return createContext('STATEMENT_START', 'UNKNOWN', {
      isAtKeywordBoundary: true,
      containingNode: clauseNode,
      partialToken,
    })
  }

  // Check for INSERT INTO table (columns) - expects VALUES/SELECT/DEFAULT VALUES
  if (statementType === 'INSERT' && isAfterInsertColumns(tokensUpToCursor)) {
    return createContext('INSERT_VALUES', statementType, {
      isAtKeywordBoundary: true,
      containingNode: clauseNode,
      partialToken,
    })
  }

  // Check if cursor is right after a keyword
  const lastKeyword = findLastKeyword(tokensUpToCursor)
  const isAfterKeyword = lastToken?.type === 'keyword'
  const isAfterComma = lastToken?.value === ','

  // Detect if user is typing an operator that could be extended
  // e.g., "<" could become "<=" or "<>", "!" could become "!="
  const extendableOperators = ['<', '>', '!']
  const isTypingOperator = lastToken?.type === 'operator' &&
    extendableOperators.includes(lastToken.value) &&
    cursorPosition === lastToken.end // cursor immediately after operator
  const partialOperator = isTypingOperator ? lastToken!.value : null

  // isAfterOperator means a completed operator followed by space (expects value)
  // This is different from isTypingOperator where user might want to extend the operator
  const isAfterOperator = !isTypingOperator && (
    lastToken?.type === 'operator' || ['=', '<', '>', '!', '+', '-'].some((op) => lastToken?.value?.includes(op))
  )

  // Determine section based on clause and keywords
  const section = determineSectionFromContext(
    clauseNode,
    lastKeyword,
    isAfterKeyword,
    isAfterComma,
    tokensUpToCursor,
    sql,
    partialToken
  )

  // Calculate subquery depth
  const depth = calculateSubqueryDepth(tokensUpToCursor)

  // When there's a partial token, look at the token before it to determine context
  // e.g., "WHERE col = 1 G|" - look at "1" to detect completed expression
  const contextToken = partialToken && tokensUpToCursor.length >= 2
    ? tokensUpToCursor[tokensUpToCursor.length - 2]  // Token before partial
    : lastToken
  const contextTokens = partialToken && tokensUpToCursor.length >= 2
    ? tokensUpToCursor.slice(0, -1)  // Exclude partial token
    : tokensUpToCursor

  // Check if context token is a value (identifier or literal)
  const isContextTokenValue = contextToken?.type === 'identifier' || contextToken?.type === 'literal'

  // Detect if we're after a completed value (identifier or literal, with space)
  // When there's a partial token, we're typing something after a completed value
  const isAfterCompletedValue = (
    !partialToken ? (
      !isAfterComma &&
      !isAfterKeyword &&
      !isAfterOperator &&
      !isTypingOperator &&
      (lastToken?.type === 'identifier' || lastToken?.type === 'literal')
    ) : (
      // With partial token, check the token before it
      isContextTokenValue
    )
  )

  // Detect if we're after a completed expression (expr op expr)
  // Pattern: identifier/literal, then operator, then identifier/literal, then space/partial
  // e.g., "WHERE col = val |" or "WHERE id > 5 G|"
  const isAfterCompletedExpression = isAfterCompletedValue &&
    hasComparisonBeforeLastToken(contextTokens)

  // After completed identifier means: after a single identifier, no operator before
  // e.g., "WHERE col |" - user wants to type an operator
  const isAfterCompletedIdentifier = isAfterCompletedValue &&
    !isAfterCompletedExpression &&
    (partialToken ? contextToken?.type === 'identifier' : lastToken?.type === 'identifier')

  // Detect if we're after NOT keyword - suggests IN, LIKE, BETWEEN, etc.
  const isAfterNot = isAfterKeyword && lastToken?.value?.toUpperCase() === 'NOT'

  // Detect if we're after an ORDER BY modifier (ASC, DESC, FIRST, LAST)
  const ORDER_BY_MODIFIERS_SET = new Set(['ASC', 'DESC', 'FIRST', 'LAST'])
  const isAfterOrderByModifier = isAfterKeyword &&
    lastToken?.value !== undefined &&
    ORDER_BY_MODIFIERS_SET.has(lastToken.value.toUpperCase())

  return createContext(section, statementType, {
    isAtKeywordBoundary: isAfterKeyword,
    isAfterComma,
    isAfterOperator,
    isAfterCompletedIdentifier: isAfterCompletedIdentifier && !isAfterCompletedExpression,
    isAfterCompletedExpression,
    isTypingOperator,
    partialOperator,
    isAfterNot,
    isAfterOrderByModifier,
    partialToken,
    tablePrefix: null,
    depth,
    containingNode: clauseNode,
  })
}

/**
 * Check if there's a comparison operator before the last token (identifier or literal).
 * Detects patterns like "col = val" or "id > 5" to identify completed expressions.
 */
function hasComparisonBeforeLastToken(tokens: Token[]): boolean {
  if (tokens.length < 3) return false

  // Look backwards from the end (skip last token which is the identifier after space)
  // We need: identifier/literal, then operator, then identifier/literal
  const comparisonOps = ['=', '<>', '!=', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN', 'BETWEEN']

  for (let i = tokens.length - 2; i >= 0; i--) {
    const token = tokens[i]

    // Skip whitespace
    if (token.type === 'whitespace') continue

    // Found an operator - check if it's a comparison
    if (token.type === 'operator' || (token.type === 'keyword' && comparisonOps.includes(token.value.toUpperCase()))) {
      return true
    }

    // Found something else (identifier, keyword, etc.) - stop looking
    // We only want to find an operator immediately before the last identifier
    break
  }

  return false
}

/**
 * Create a CursorContext with defaults.
 */
function createContext(
  section: SQLSection,
  statementType: StatementType,
  overrides: Partial<CursorContext> = {}
): CursorContext {
  return {
    section,
    statementType,
    isAtKeywordBoundary: false,
    isAfterComma: false,
    isAfterOperator: false,
    isAfterCompletedIdentifier: false,
    isAfterCompletedExpression: false,
    isTypingOperator: false,
    partialOperator: null,
    isAfterNot: false,
    isAfterOrderByModifier: false,
    partialToken: null,
    tablePrefix: null,
    depth: 0,
    parentContext: null,
    containingNode: null,
    ...overrides,
  }
}

/**
 * Detect statement type from the statement node.
 */
function detectStatementType(node: SyntaxNode | null): StatementType {
  if (!node) return 'UNKNOWN'

  const type = node.type.toLowerCase()
  if (type.includes('select')) return 'SELECT'
  if (type.includes('insert')) return 'INSERT'
  if (type.includes('update')) return 'UPDATE'
  if (type.includes('delete')) return 'DELETE'
  if (type.includes('with')) return 'WITH'
  if (type.includes('call')) return 'CALL'
  if (type.includes('create')) return 'CREATE'

  return 'UNKNOWN'
}

/**
 * Detect section from clause node type.
 */
function detectSectionFromClause(node: SyntaxNode | null): SQLSection {
  if (!node) return 'UNKNOWN'

  const type = node.type.toLowerCase()

  if (type.includes('select_clause')) return 'SELECT_COLUMNS'
  if (type.includes('from_clause')) return 'FROM_TABLE'
  if (type.includes('where_clause')) return 'WHERE_CONDITION'
  if (type.includes('group_by')) return 'GROUP_BY'
  if (type.includes('having')) return 'HAVING'
  if (type.includes('order_by')) return 'ORDER_BY'
  if (type.includes('limit')) return 'LIMIT'
  if (type.includes('offset')) return 'OFFSET'
  if (type.includes('with_clause')) return 'WITH_CTE_NAME'
  if (type.includes('insert')) return 'INSERT_TABLE'
  if (type.includes('update')) return 'UPDATE_TABLE'
  if (type.includes('set_clause')) return 'UPDATE_SET'
  if (type.includes('delete')) return 'DELETE_TABLE'
  if (type.includes('call')) return 'CALL_PROCEDURE'

  return 'UNKNOWN'
}

/**
 * Determine section from token context when clause detection is ambiguous.
 */
function determineSectionFromContext(
  clauseNode: SyntaxNode | null,
  lastKeyword: Token | null,
  _isAfterKeyword: boolean,
  isAfterComma: boolean,
  tokens: Token[],
  _sql: string,
  partialToken?: string | null
): SQLSection {
  const lastKeywordValue = lastKeyword?.value?.toUpperCase()
  // For CREATE TABLE context analysis, exclude partial token to avoid misdetection
  const tokensForCreateTable = partialToken && tokens.length > 0 ? tokens.slice(0, -1) : tokens

  // Handle JOIN specifically
  if (lastKeywordValue && JOIN_KEYWORDS.includes(lastKeywordValue)) {
    return 'JOIN_TABLE'
  }

  // Handle ORDER BY / GROUP BY
  if (lastKeywordValue === 'BY') {
    const prevKeyword = findKeywordBefore(tokens, lastKeyword)
    if (prevKeyword?.value?.toUpperCase() === 'ORDER') return 'ORDER_BY'
    if (prevKeyword?.value?.toUpperCase() === 'GROUP') return 'GROUP_BY'
  }

  // Handle incomplete ORDER/GROUP - need BY to complete the compound keyword
  if (lastKeywordValue === 'ORDER') return 'ORDER_BY_INCOMPLETE'
  if (lastKeywordValue === 'GROUP') return 'GROUP_BY_INCOMPLETE'

  // Handle IS - need NULL/TRUE/FALSE/NOT NULL/DISTINCT FROM to complete
  if (lastKeywordValue === 'IS') return 'IS_INCOMPLETE'

  // Handle IS NOT pattern - when NOT follows IS, suggest NULL/TRUE/FALSE (not IN/LIKE/BETWEEN)
  if (lastKeywordValue === 'NOT') {
    const prevKeyword = findKeywordBefore(tokens, lastKeyword)
    if (prevKeyword?.value?.toUpperCase() === 'IS') {
      return 'IS_NOT_INCOMPLETE'
    }
    // Otherwise, regular NOT handling - fall through to EXPRESSION_KEYWORDS
  }

  // Handle NULLS - need FIRST/LAST to complete (in ORDER BY context)
  if (lastKeywordValue === 'NULLS') return 'NULLS_INCOMPLETE'

  // Handle ORDER BY modifiers - stay in ORDER_BY section after ASC, DESC, FIRST, LAST
  // e.g., "ORDER BY col ASC |" should still show ORDER BY suggestions
  const ORDER_BY_MODIFIERS = ['ASC', 'DESC', 'FIRST', 'LAST']
  if (lastKeywordValue && ORDER_BY_MODIFIERS.includes(lastKeywordValue)) {
    return 'ORDER_BY'
  }

  // Handle ON (join condition)
  if (lastKeywordValue === 'ON' && isInJoinContext(tokens)) {
    return 'JOIN_CONDITION'
  }

  // CALL expects a procedure name
  if (lastKeywordValue === 'CALL') return 'CALL_PROCEDURE'

  // RETURNING expects columns (in UPDATE, INSERT, DELETE)
  if (lastKeywordValue === 'RETURNING') return 'RETURNING'

  // CREATE expects object type (TABLE, INDEX, VIEW, etc.)
  if (lastKeywordValue === 'CREATE') return 'CREATE_OBJECT'
  // TEMP/TEMPORARY/UNLOGGED after CREATE still expects object type
  if (lastKeywordValue === 'TEMP' || lastKeywordValue === 'TEMPORARY' || lastKeywordValue === 'UNLOGGED') {
    // Check if we're in CREATE context
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].value === ';') break
      if (tokens[i].value?.toUpperCase() === 'CREATE') return 'CREATE_OBJECT'
    }
  }

  // Check for CREATE TABLE context - do this early to properly handle all CREATE TABLE sections
  const createCtx = getCreateTableContext(tokensForCreateTable)
  if (createCtx.isInCreateTable) {
    // After the closing paren - suggest table options
    if (createCtx.isAfterColumnList) {
      return 'CREATE_TABLE_OPTIONS'
    }
    // Inside column list
    if (createCtx.isInsideColumnList) {
      switch (createCtx.lastColumnElement) {
        case 'none':
        case 'comma':
          return 'CREATE_TABLE_COLUMNS'
        case 'name':
          return 'CREATE_TABLE_COLUMN_TYPE'
        case 'type':
        case 'constraint':
          return 'CREATE_TABLE_COLUMN_CONSTRAINT'
      }
    }
    // After table name but before opening paren, or right after TABLE keyword
    if (!createCtx.isAfterTableName || (createCtx.isAfterTableName && !createCtx.isInsideColumnList && !createCtx.isAfterColumnList)) {
      return 'CREATE_TABLE_NAME'
    }
  }

  // USING in DELETE context expects tables (like FROM)
  if (lastKeywordValue === 'USING' && isInDeleteContext(tokens)) {
    return 'FROM_TABLE'
  }

  // Table-preceding keywords
  if (lastKeywordValue && TABLE_PRECEDING_KEYWORDS.includes(lastKeywordValue)) {
    if (lastKeywordValue === 'FROM') {
      // Check if this is DELETE FROM - use DELETE_TABLE section
      if (isInDeleteContext(tokens)) {
        return 'DELETE_TABLE'
      }
      return 'FROM_TABLE'
    }
    if (lastKeywordValue === 'INTO') return 'INSERT_TABLE'
    if (lastKeywordValue === 'UPDATE') return 'UPDATE_TABLE'
    if (lastKeywordValue === 'TABLE') return 'FROM_TABLE'
    return 'FROM_TABLE'
  }

  // Expression-preceding keywords
  if (lastKeywordValue && EXPRESSION_KEYWORDS.includes(lastKeywordValue)) {
    if (lastKeywordValue === 'SELECT') return 'SELECT_COLUMNS'
    if (lastKeywordValue === 'WHERE') return 'WHERE_CONDITION'
    if (lastKeywordValue === 'HAVING') return 'HAVING'
    if (lastKeywordValue === 'SET') return 'UPDATE_SET'
    return 'WHERE_CONDITION' // AND, OR, ON, etc.
  }

  // After comma - determine from clause context
  if (isAfterComma) {
    return determineSectionAfterComma(tokens, clauseNode)
  }

  // Fall back to clause node detection
  if (clauseNode) {
    return detectSectionFromClause(clauseNode)
  }

  // No keyword found in current statement = likely at statement start
  if (!lastKeyword) {
    return 'STATEMENT_START'
  }

  return 'UNKNOWN'
}

// SQL clause keywords that define statement structure
// These are the keywords we look for to determine the current clause context
const CLAUSE_KEYWORDS = new Set([
  // DML keywords
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE',
  // DDL keywords
  'CREATE', 'ALTER', 'DROP', 'TRUNCATE',
  // Clause keywords
  'FROM', 'WHERE', 'SET', 'INTO', 'VALUES', 'RETURNING',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL',
  'ON', 'USING', 'AND', 'OR', 'NOT',
  'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH',
  'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
  'WITH', 'AS', 'RECURSIVE',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CALL',
  'IS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
  'FOR', 'TABLE', 'ONLY',
  'WINDOW', 'PARTITION', 'OVER',
  'LATERAL', 'ROWS', 'RANGE', 'GROUPS',
  'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW', 'UNBOUNDED',
  // CREATE TABLE specific
  'INHERITS', 'TABLESPACE', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'IF',
  'PRIMARY', 'KEY', 'UNIQUE', 'CHECK', 'REFERENCES', 'FOREIGN',
  'DEFAULT', 'CONSTRAINT', 'NULL', 'COLLATE', 'GENERATED', 'IDENTITY',
  'DEFERRABLE', 'INITIALLY', 'DEFERRED', 'IMMEDIATE',
])

/**
 * Find the last clause keyword token in the token list (within current statement).
 * Scans backwards through tokens, looking for SQL clause keywords.
 * Skips type names and other keywords that aren't clause-defining.
 */
function findLastKeyword(tokens: Token[]): Token | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    // Stop at statement boundary
    if (token.value === ';') {
      return null
    }
    // Only return clause keywords, not type names or other keywords
    if (token.type === 'keyword' && CLAUSE_KEYWORDS.has(token.value.toUpperCase())) {
      return token
    }
    // Continue past all other tokens (identifiers, literals, operators,
    // type-name keywords like NAME, TEXT, etc.)
  }
  return null
}

/**
 * Find the keyword before a given token.
 * Uses position-based comparison since token objects may not be identical references.
 */
function findKeywordBefore(tokens: Token[], targetToken: Token | null): Token | null {
  if (!targetToken) return null

  let foundTarget = false
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    // Compare by position since token objects may not be identical references
    if (token.start === targetToken.start && token.end === targetToken.end) {
      foundTarget = true
      continue
    }
    if (foundTarget && token.type === 'keyword') {
      return token
    }
  }
  return null
}

/**
 * Check if we're in a JOIN context (ON after JOIN).
 */
function isInJoinContext(tokens: Token[]): boolean {
  let parenDepth = 0
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token.value === ')') parenDepth++
    if (token.value === '(') parenDepth--

    if (parenDepth === 0 && token.type === 'keyword') {
      const upper = token.value.toUpperCase()
      if (JOIN_KEYWORDS.includes(upper)) return true
      if (upper === 'FROM' || upper === 'WHERE' || upper === 'SELECT') return false
    }
  }
  return false
}

/**
 * Check if we're in a DELETE statement context.
 * Looks for DELETE keyword before FROM/USING at the same nesting level.
 */
function isInDeleteContext(tokens: Token[]): boolean {
  let parenDepth = 0
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token.value === ')') parenDepth++
    if (token.value === '(') parenDepth--

    // Stop at statement boundary
    if (token.value === ';') return false

    if (parenDepth === 0 && token.type === 'keyword') {
      const upper = token.value.toUpperCase()
      // Found DELETE at top level - we're in a DELETE statement
      if (upper === 'DELETE') return true
      // Found another DML statement keyword - not in DELETE context
      if (upper === 'SELECT' || upper === 'INSERT' || upper === 'UPDATE') return false
    }
  }
  return false
}

/**
 * Check if we're in a CREATE TABLE statement context.
 */
interface CreateTableContext {
  isInCreateTable: boolean
  isAfterTableName: boolean
  isInsideColumnList: boolean
  isAfterColumnList: boolean
  lastColumnElement: 'name' | 'type' | 'constraint' | 'comma' | 'none'
}

function getCreateTableContext(tokens: Token[]): CreateTableContext {
  const result: CreateTableContext = {
    isInCreateTable: false,
    isAfterTableName: false,
    isInsideColumnList: false,
    isAfterColumnList: false,
    lastColumnElement: 'none',
  }

  let parenDepth = 0
  let foundCreateTable = false
  let tableNameSeen = false
  let columnListStart = -1

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const upper = token.value?.toUpperCase()

    if (token.value === ';') {
      // Reset on statement boundary
      foundCreateTable = false
      tableNameSeen = false
      parenDepth = 0
      columnListStart = -1
      continue
    }

    // Detect CREATE ... TABLE pattern
    if (upper === 'CREATE') {
      for (let j = i + 1; j < tokens.length; j++) {
        const nextUpper = tokens[j].value?.toUpperCase()
        if (nextUpper === 'TABLE') { foundCreateTable = true; break }
        if (!['TEMP', 'TEMPORARY', 'UNLOGGED', 'IF', 'NOT', 'EXISTS'].includes(nextUpper || '')) break
      }
    }

    // First identifier after TABLE keyword is the table name
    if (foundCreateTable && !tableNameSeen && token.type === 'identifier') {
      tableNameSeen = true
    }

    // Track parentheses
    if (token.value === '(') {
      if (foundCreateTable && tableNameSeen && columnListStart === -1) columnListStart = i
      parenDepth++
    }
    if (token.value === ')') parenDepth--
  }

  result.isInCreateTable = foundCreateTable
  result.isAfterTableName = tableNameSeen
  result.isInsideColumnList = columnListStart !== -1 && parenDepth > 0
  result.isAfterColumnList = columnListStart !== -1 && parenDepth === 0

  // Analyze position within column list
  if (result.isInsideColumnList) {
    let depth = 0
    let last: typeof result.lastColumnElement = 'none'
    const CONSTRAINT_KW = new Set(['NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'KEY', 'UNIQUE', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'COLLATE', 'GENERATED', 'DEFERRABLE', 'INITIALLY'])

    for (let i = columnListStart + 1; i < tokens.length; i++) {
      const t = tokens[i]
      const u = t.value?.toUpperCase()
      if (t.value === '(') depth++
      if (t.value === ')') { if (depth === 0) break; depth-- }
      if (depth > 0) continue

      if (t.value === ',') last = 'comma'
      else if (t.type === 'identifier' && (last === 'comma' || last === 'none')) last = 'name'
      else if ((t.type === 'keyword' && PG_DATA_TYPES.has(u || '')) || (t.type === 'identifier' && last === 'name')) last = 'type'
      else if (t.type === 'keyword' && last === 'type' && CONSTRAINT_KW.has(u || '')) last = 'constraint'
    }
    result.lastColumnElement = last
  }

  return result
}

/**
 * Determine section when cursor is after a comma.
 */
function determineSectionAfterComma(tokens: Token[], clauseNode: SyntaxNode | null): SQLSection {
  // Scan back to find the clause we're in
  let parenDepth = 0
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token.value === ')') parenDepth++
    if (token.value === '(') parenDepth--

    if (parenDepth === 0 && token.type === 'keyword') {
      const upper = token.value.toUpperCase()

      if (upper === 'SELECT') return 'SELECT_COLUMNS'
      if (upper === 'FROM') return 'FROM_TABLE'
      if (upper === 'BY') {
        // Check for ORDER BY or GROUP BY
        const prevKeyword = findKeywordBefore(tokens.slice(0, i + 1), token)
        if (prevKeyword?.value?.toUpperCase() === 'ORDER') return 'ORDER_BY'
        if (prevKeyword?.value?.toUpperCase() === 'GROUP') return 'GROUP_BY'
      }
      if (upper === 'WHERE' || upper === 'AND' || upper === 'OR') return 'WHERE_CONDITION'
      if (upper === 'SET') return 'UPDATE_SET'
    }
  }

  // Fall back to clause node
  if (clauseNode) {
    return detectSectionFromClause(clauseNode)
  }

  return 'SELECT_COLUMNS' // Default assumption
}

/**
 * Check if cursor is after INSERT INTO table (columns) - expecting VALUES/SELECT/OVERRIDING.
 * Returns true for "INSERT INTO t (a,b) |" but false for "INSERT INTO t VALUES (1) |"
 */
function isAfterInsertColumns(tokens: Token[]): boolean {
  // Find closing paren - last token, or second-to-last if typing partial
  let closeIdx = tokens.length - 1
  if (tokens[closeIdx]?.value !== ')') {
    closeIdx--
    if (tokens[closeIdx]?.value !== ')') return false
  }

  // Scan backwards, tracking paren depth. At depth 0, look for INTO (good) or VALUES (bad)
  let depth = 0
  for (let i = closeIdx; i >= 0; i--) {
    const val = tokens[i].value
    if (val === ')') depth++
    if (val === '(') depth--

    if (depth === 0 && tokens[i].type === 'keyword') {
      const upper = val.toUpperCase()
      if (upper === 'VALUES') return false // It's a VALUES list, not column list
      if (upper === 'INTO') return true    // Found INSERT INTO pattern
    }
  }
  return false
}

/**
 * Calculate subquery nesting depth.
 */
function calculateSubqueryDepth(tokens: Token[]): number {
  let depth = 0
  let maxDepth = 0

  for (const token of tokens) {
    if (token.value === '(') {
      depth++
      maxDepth = Math.max(maxDepth, depth)
    }
    if (token.value === ')') {
      depth--
    }
  }

  // Return current depth (unclosed parens)
  return depth
}

/**
 * Check if cursor is at a position expecting a table alias.
 */
export function isExpectingAlias(tokenized: TokenizedSQL, _cursorPosition: number): boolean {
  const tokens = getTokensUpToCursor(tokenized, true)
  if (tokens.length < 2) return false

  const lastToken = tokens[tokens.length - 1]
  const prevToken = tokens[tokens.length - 2]

  // After identifier in FROM clause (not after AS)
  if (prevToken?.type === 'identifier') {
    const beforePrev = tokens.length > 2 ? tokens[tokens.length - 3] : null
    const beforePrevUpper = beforePrev?.value?.toUpperCase()

    if (beforePrevUpper === 'FROM' || beforePrevUpper === 'JOIN') {
      // Check if last token is AS
      if (lastToken?.value?.toUpperCase() === 'AS') {
        return true
      }
      // Or if we're right after the table name (no AS)
      if (lastToken?.type === 'identifier') {
        return true
      }
    }
  }

  // After AS keyword
  if (lastToken?.value?.toUpperCase() === 'AS') {
    return true
  }

  return false
}

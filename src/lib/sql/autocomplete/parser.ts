/**
 * SQL Parser Module
 *
 * Provides error-tolerant parsing for autocomplete.
 * Uses heuristic-based parsing that handles incomplete SQL gracefully.
 *
 * Future enhancement: integrate web-tree-sitter for proper AST when available.
 */

import type { Token, SyntaxNode, SyntaxTree, TokenizedSQL } from './types'

/**
 * Create a syntax node from token range with children.
 */
function createNode(
  type: string,
  start: number,
  end: number,
  text: string,
  children: SyntaxNode[] = [],
  isError: boolean = false
): SyntaxNode {
  return {
    type,
    start,
    end,
    text,
    children,
    isError,
    isMissing: false,
    parent: null,
    namedChildren: children.filter((c) => !c.type.startsWith('_')),
    fieldName: null,
  }
}

/**
 * Build a lightweight syntax tree from tokens.
 *
 * This is a heuristic-based parser that identifies SQL clauses and structure
 * without requiring a full grammar. It handles incomplete SQL gracefully.
 */
export function parseFromTokens(tokenized: TokenizedSQL, sql: string): SyntaxTree {
  const { tokens } = tokenized
  const errors: SyntaxNode[] = []
  const children: SyntaxNode[] = []

  if (tokens.length === 0) {
    const root = createNode('source_file', 0, sql.length, sql, [])
    return { root, errors: [], hasErrors: false }
  }

  // Group tokens into statements (split by semicolons)
  let statementStart = 0
  let currentTokens: Token[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    currentTokens.push(token)

    if (token.value === ';' || i === tokens.length - 1) {
      // Parse the current statement
      if (currentTokens.length > 0) {
        const statementNode = parseStatement(currentTokens, sql, statementStart)
        children.push(statementNode)

        if (statementNode.isError) {
          errors.push(statementNode)
        }

        // Collect errors from children
        collectErrors(statementNode, errors)
      }

      statementStart = token.end
      currentTokens = []
    }
  }

  const root = createNode('source_file', 0, sql.length, sql, children)

  // Set parent references
  setParentReferences(root)

  return { root, errors, hasErrors: errors.length > 0 }
}

/**
 * Parse a single SQL statement from tokens.
 */
function parseStatement(tokens: Token[], sql: string, baseOffset: number): SyntaxNode {
  if (tokens.length === 0) {
    return createNode('empty_statement', baseOffset, baseOffset, '', [], false)
  }

  const firstToken = tokens[0]
  const lastToken = tokens[tokens.length - 1]
  const statementText = sql.slice(firstToken.start, lastToken.end)
  const statementType = firstToken.value.toUpperCase()

  // Detect statement type
  switch (statementType) {
    case 'SELECT':
      return parseSelectStatement(tokens, sql, firstToken.start, lastToken.end)
    case 'WITH':
      return parseWithStatement(tokens, sql, firstToken.start, lastToken.end)
    case 'INSERT':
      return parseInsertStatement(tokens, sql, firstToken.start, lastToken.end)
    case 'UPDATE':
      return parseUpdateStatement(tokens, sql, firstToken.start, lastToken.end)
    case 'DELETE':
      return parseDeleteStatement(tokens, sql, firstToken.start, lastToken.end)
    case 'CALL':
      return parseCallStatement(tokens, sql, firstToken.start, lastToken.end)
    default:
      return createNode('unknown_statement', firstToken.start, lastToken.end, statementText, [])
  }
}

/**
 * Parse a SELECT statement into clause nodes.
 */
function parseSelectStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []
  const clauses = splitIntoClauses(tokens, [
    'SELECT',
    'FROM',
    'WHERE',
    'GROUP',
    'HAVING',
    'ORDER',
    'LIMIT',
    'OFFSET',
    'FOR',
  ])

  for (const clause of clauses) {
    if (clause.tokens.length === 0) continue

    const clauseType = clause.tokens[0].value.toUpperCase()
    const clauseStart = clause.tokens[0].start
    const clauseEnd = clause.tokens[clause.tokens.length - 1].end
    const clauseText = sql.slice(clauseStart, clauseEnd)

    let nodeType: string

    switch (clauseType) {
      case 'SELECT':
        nodeType = 'select_clause'
        break
      case 'FROM':
        nodeType = 'from_clause'
        break
      case 'WHERE':
        nodeType = 'where_clause'
        break
      case 'GROUP':
        nodeType = 'group_by_clause'
        break
      case 'HAVING':
        nodeType = 'having_clause'
        break
      case 'ORDER':
        nodeType = 'order_by_clause'
        break
      case 'LIMIT':
        nodeType = 'limit_clause'
        break
      case 'OFFSET':
        nodeType = 'offset_clause'
        break
      case 'FOR':
        nodeType = 'for_clause'
        break
      default:
        nodeType = 'unknown_clause'
    }

    children.push(createNode(nodeType, clauseStart, clauseEnd, clauseText, []))
  }

  return createNode('select_statement', start, end, sql.slice(start, end), children)
}

/**
 * Parse a WITH (CTE) statement.
 */
function parseWithStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []

  // Find the main query after CTEs (SELECT, INSERT, UPDATE, DELETE)
  let mainQueryIndex = -1
  let parenDepth = 0

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.value === '(') parenDepth++
    if (token.value === ')') parenDepth--

    if (
      parenDepth === 0 &&
      ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(token.value.toUpperCase())
    ) {
      mainQueryIndex = i
      break
    }
  }

  if (mainQueryIndex > 0) {
    // WITH clause tokens
    const withTokens = tokens.slice(0, mainQueryIndex)
    if (withTokens.length > 0) {
      const withClause = createNode(
        'with_clause',
        withTokens[0].start,
        withTokens[withTokens.length - 1].end,
        sql.slice(withTokens[0].start, withTokens[withTokens.length - 1].end),
        []
      )
      children.push(withClause)
    }

    // Main query tokens
    const mainQueryTokens = tokens.slice(mainQueryIndex)
    const mainStmt = parseStatement(mainQueryTokens, sql, mainQueryTokens[0].start)
    children.push(mainStmt)
  }

  return createNode('with_statement', start, end, sql.slice(start, end), children)
}

/**
 * Parse an INSERT statement.
 */
function parseInsertStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []
  const clauses = splitIntoClauses(tokens, ['INSERT', 'VALUES', 'SELECT', 'RETURNING', 'ON'])

  for (const clause of clauses) {
    if (clause.tokens.length === 0) continue

    const clauseType = clause.tokens[0].value.toUpperCase()
    const clauseStart = clause.tokens[0].start
    const clauseEnd = clause.tokens[clause.tokens.length - 1].end

    let nodeType: string
    switch (clauseType) {
      case 'INSERT':
        nodeType = 'insert_clause'
        break
      case 'VALUES':
        nodeType = 'values_clause'
        break
      case 'SELECT':
        nodeType = 'select_clause'
        break
      case 'RETURNING':
        nodeType = 'returning_clause'
        break
      case 'ON':
        nodeType = 'on_conflict_clause'
        break
      default:
        nodeType = 'unknown_clause'
    }

    children.push(createNode(nodeType, clauseStart, clauseEnd, sql.slice(clauseStart, clauseEnd), []))
  }

  return createNode('insert_statement', start, end, sql.slice(start, end), children)
}

/**
 * Parse an UPDATE statement.
 */
function parseUpdateStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []
  const clauses = splitIntoClauses(tokens, ['UPDATE', 'SET', 'FROM', 'WHERE', 'RETURNING'])

  for (const clause of clauses) {
    if (clause.tokens.length === 0) continue

    const clauseType = clause.tokens[0].value.toUpperCase()
    const clauseStart = clause.tokens[0].start
    const clauseEnd = clause.tokens[clause.tokens.length - 1].end

    let nodeType: string
    switch (clauseType) {
      case 'UPDATE':
        nodeType = 'update_clause'
        break
      case 'SET':
        nodeType = 'set_clause'
        break
      case 'FROM':
        nodeType = 'from_clause'
        break
      case 'WHERE':
        nodeType = 'where_clause'
        break
      case 'RETURNING':
        nodeType = 'returning_clause'
        break
      default:
        nodeType = 'unknown_clause'
    }

    children.push(createNode(nodeType, clauseStart, clauseEnd, sql.slice(clauseStart, clauseEnd), []))
  }

  return createNode('update_statement', start, end, sql.slice(start, end), children)
}

/**
 * Parse a DELETE statement.
 */
function parseDeleteStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []
  const clauses = splitIntoClauses(tokens, ['DELETE', 'FROM', 'USING', 'WHERE', 'RETURNING'])

  for (const clause of clauses) {
    if (clause.tokens.length === 0) continue

    const clauseType = clause.tokens[0].value.toUpperCase()
    const clauseStart = clause.tokens[0].start
    const clauseEnd = clause.tokens[clause.tokens.length - 1].end

    let nodeType: string
    switch (clauseType) {
      case 'DELETE':
        nodeType = 'delete_keyword'
        break
      case 'FROM':
        nodeType = 'from_clause'
        break
      case 'USING':
        nodeType = 'using_clause'
        break
      case 'WHERE':
        nodeType = 'where_clause'
        break
      case 'RETURNING':
        nodeType = 'returning_clause'
        break
      default:
        nodeType = 'unknown_clause'
    }

    children.push(createNode(nodeType, clauseStart, clauseEnd, sql.slice(clauseStart, clauseEnd), []))
  }

  return createNode('delete_statement', start, end, sql.slice(start, end), children)
}

/**
 * Parse a CALL statement.
 * CALL procedure_name(args...)
 */
function parseCallStatement(
  tokens: Token[],
  sql: string,
  start: number,
  end: number
): SyntaxNode {
  const children: SyntaxNode[] = []

  // The CALL keyword
  if (tokens.length > 0) {
    const callToken = tokens[0]
    children.push(createNode('call_keyword', callToken.start, callToken.end, callToken.value, []))
  }

  // The procedure name (everything after CALL)
  if (tokens.length > 1) {
    const restStart = tokens[1].start
    const restEnd = tokens[tokens.length - 1].end
    children.push(createNode('procedure_call', restStart, restEnd, sql.slice(restStart, restEnd), []))
  }

  return createNode('call_statement', start, end, sql.slice(start, end), children)
}

/**
 * Split tokens into clauses based on keywords.
 */
function splitIntoClauses(
  tokens: Token[],
  keywords: string[]
): { keyword: string; tokens: Token[] }[] {
  const clauses: { keyword: string; tokens: Token[] }[] = []
  let currentClause: Token[] = []
  let currentKeyword = ''
  let parenDepth = 0

  for (const token of tokens) {
    // Track parentheses depth - don't split on keywords inside parens
    if (token.value === '(') parenDepth++
    if (token.value === ')') parenDepth--

    const upperValue = token.value.toUpperCase()

    // Check if this is a clause-starting keyword at top level
    if (parenDepth === 0 && keywords.includes(upperValue)) {
      // Save previous clause
      if (currentClause.length > 0 || currentKeyword) {
        clauses.push({ keyword: currentKeyword, tokens: currentClause })
      }
      currentKeyword = upperValue
      currentClause = [token]
    } else {
      currentClause.push(token)
    }
  }

  // Add final clause
  if (currentClause.length > 0 || currentKeyword) {
    clauses.push({ keyword: currentKeyword, tokens: currentClause })
  }

  return clauses
}

/**
 * Set parent references for all nodes in the tree.
 */
function setParentReferences(node: SyntaxNode, parent: SyntaxNode | null = null): void {
  node.parent = parent
  for (const child of node.children) {
    setParentReferences(child, node)
  }
}

/**
 * Collect all error nodes from a tree.
 */
function collectErrors(node: SyntaxNode, errors: SyntaxNode[]): void {
  if (node.isError && !errors.includes(node)) {
    errors.push(node)
  }
  for (const child of node.children) {
    collectErrors(child, errors)
  }
}

/**
 * Find the clause node containing a given position.
 */
export function findClauseAtPosition(tree: SyntaxTree, position: number): SyntaxNode | null {
  function findInNode(node: SyntaxNode): SyntaxNode | null {
    // Check if position is within this node
    if (position < node.start || position > node.end) {
      return null
    }

    // Check children first (more specific)
    for (const child of node.children) {
      const found = findInNode(child)
      if (found) return found
    }

    // Return this node if it's a clause
    if (node.type.endsWith('_clause') || node.type.endsWith('_statement')) {
      return node
    }

    return null
  }

  return findInNode(tree.root)
}

/**
 * Find the statement node containing a given position.
 */
export function findStatementAtPosition(tree: SyntaxTree, position: number): SyntaxNode | null {
  for (const child of tree.root.children) {
    if (position >= child.start && position <= child.end) {
      return child
    }
  }
  return tree.root.children[tree.root.children.length - 1] || null
}

/**
 * Extract the current statement containing the cursor position.
 * Uses token-based semicolon detection to find statement boundaries.
 * Returns the statement text and cursor position relative to statement start.
 */
export function extractCurrentStatement(
  tokenized: TokenizedSQL,
  sql: string,
  cursorPosition: number
): { statementSql: string; statementCursor: number; statementStart: number } {
  const { tokens } = tokenized

  // Find semicolon positions from tokens
  const semicolons: number[] = []
  for (const token of tokens) {
    if (token.value === ';') {
      semicolons.push(token.end) // Position after the semicolon
    }
  }

  // Find statement boundaries
  let statementStart = 0
  let statementEnd = sql.length

  for (const semiEnd of semicolons) {
    if (semiEnd <= cursorPosition) {
      // This semicolon is before or at cursor, statement starts after it
      statementStart = semiEnd
    } else {
      // This semicolon is after cursor, statement ends at the semicolon
      // (include the semicolon in the statement for proper parsing)
      statementEnd = semiEnd
      break
    }
  }

  // Extract statement text
  const statementSql = sql.slice(statementStart, statementEnd)

  // Calculate cursor position relative to statement start
  const statementCursor = cursorPosition - statementStart

  return {
    statementSql,
    statementCursor: Math.max(0, statementCursor),
    statementStart,
  }
}

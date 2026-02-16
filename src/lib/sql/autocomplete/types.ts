/**
 * Autocomplete Pipeline Types
 *
 * This file defines all interfaces for the modular autocomplete pipeline:
 * SQL + Cursor → Tokenizer → TreeSitter → SectionDetector → ScopeAnalyzer → CandidateGenerator → Ranker
 */

// ============================================================================
// 1. TOKENIZER TYPES
// ============================================================================

export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'operator'
  | 'literal'
  | 'punctuation'
  | 'whitespace'
  | 'comment'

export interface Token {
  type: TokenType
  value: string
  start: number
  end: number
  /** For keywords: 1=unreserved, 2=col_name, 3=type_func, 4=reserved */
  keywordKind?: number
}

export interface TokenizedSQL {
  tokens: Token[]
  /** Index of the token the cursor is in or immediately after */
  cursorTokenIndex: number
  /** Position within that token (0 = at start, value.length = at end) */
  cursorPositionInToken: number
  /** Raw cursor position in the SQL string (for whitespace detection) */
  rawCursorPosition: number
}

// ============================================================================
// 2. TREE-SITTER PARSER TYPES
// ============================================================================

export interface SyntaxNode {
  type: string
  start: number
  end: number
  children: SyntaxNode[]
  isError: boolean
  isMissing: boolean
  text: string
  parent: SyntaxNode | null
  /** Named children only (excludes anonymous nodes like punctuation) */
  namedChildren: SyntaxNode[]
  /** Field name if this node is a named field of its parent */
  fieldName: string | null
}

export interface SyntaxTree {
  root: SyntaxNode
  /** All ERROR nodes in the tree */
  errors: SyntaxNode[]
  /** Whether the parse had any errors */
  hasErrors: boolean
}

// ============================================================================
// 3. SECTION DETECTOR TYPES
// ============================================================================

export type SQLSection =
  | 'WITH_CTE_NAME'
  | 'WITH_CTE_COLUMNS'
  | 'SELECT_COLUMNS'
  | 'SELECT_COLUMN_ALIAS'
  | 'FROM_TABLE'
  | 'FROM_TABLE_ALIAS'
  | 'JOIN_TABLE'
  | 'JOIN_CONDITION'
  | 'WHERE_CONDITION'
  | 'GROUP_BY'
  | 'GROUP_BY_INCOMPLETE'  // After GROUP, before BY
  | 'HAVING'
  | 'ORDER_BY'
  | 'ORDER_BY_INCOMPLETE'  // After ORDER, before BY
  | 'IS_INCOMPLETE'        // After IS, before NULL/TRUE/FALSE/NOT/DISTINCT
  | 'IS_NOT_INCOMPLETE'    // After IS NOT, before NULL/TRUE/FALSE
  | 'NULLS_INCOMPLETE'     // After NULLS, before FIRST/LAST
  | 'LIMIT'
  | 'OFFSET'
  | 'INSERT_TABLE'
  | 'INSERT_COLUMNS'
  | 'INSERT_VALUES'  // After INSERT INTO table (columns), expects VALUES/SELECT/DEFAULT VALUES
  | 'UPDATE_TABLE'
  | 'UPDATE_SET'
  | 'DELETE_TABLE'
  | 'RETURNING'  // After RETURNING in UPDATE/DELETE/INSERT statements
  | 'CALL_PROCEDURE'       // After CALL, expects procedure name
  | 'CREATE_OBJECT'        // After CREATE, expects object type (TABLE, INDEX, VIEW, etc.)
  | 'CREATE_TABLE_NAME'    // After CREATE TABLE, expects table name
  | 'CREATE_TABLE_COLUMNS' // Inside CREATE TABLE (...), expects column definitions
  | 'CREATE_TABLE_COLUMN_TYPE'       // After column name, expects data type
  | 'CREATE_TABLE_COLUMN_CONSTRAINT' // After column type, expects column constraints
  | 'CREATE_TABLE_OPTIONS' // After CREATE TABLE (...), expects table options
  | 'STATEMENT_START'
  | 'UNKNOWN'

export type StatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'WITH' | 'CALL' | 'CREATE' | 'UNKNOWN'

export interface CursorContext {
  section: SQLSection
  statementType: StatementType

  // Position details
  /** True if cursor is right after a clause keyword (SELECT, FROM, WHERE, etc.) */
  isAtKeywordBoundary: boolean
  /** True if cursor is right after a comma */
  isAfterComma: boolean
  /** True if cursor is right after an operator (=, <, >, etc.) with space - expects value */
  isAfterOperator: boolean
  /** True if cursor is after a completed identifier (with space, no comma) - suggests user wants operator */
  isAfterCompletedIdentifier: boolean
  /** True if cursor is after a completed comparison (expr op expr) - suggests AND/OR */
  isAfterCompletedExpression: boolean
  /** True if user is typing an operator that could be extended (e.g., < could become <= or <>) */
  isTypingOperator: boolean
  /** The partial operator being typed (e.g., "<" when user might want "<=") */
  partialOperator: string | null
  /** True if cursor is right after NOT keyword - suggests IN, LIKE, BETWEEN, etc. */
  isAfterNot: boolean
  /** True if cursor is right after an ORDER BY modifier (ASC, DESC, NULLS FIRST/LAST) */
  isAfterOrderByModifier: boolean
  /** Partial text being typed (for filtering), null if at boundary */
  partialToken: string | null

  // For column context after "table." or "alias."
  tablePrefix: string | null

  // Nesting info
  /** Subquery nesting depth (0 = top level) */
  depth: number
  /** Parent context for subqueries */
  parentContext: CursorContext | null

  // AST reference
  /** The syntax node containing the cursor */
  containingNode: SyntaxNode | null
}

// ============================================================================
// 4. SCOPE ANALYZER TYPES
// ============================================================================

export interface TableRef {
  name: string
  alias: string | null
  schema: string | null
  /** Source: 'from', 'join', 'cte', 'subquery' */
  source: 'from' | 'join' | 'cte' | 'subquery'
}

export interface ColumnRef {
  name: string
  /** Table name or alias this column belongs to */
  table: string | null
  /** Data type if known from schema */
  type: string | null
  /** Whether column can be null */
  nullable?: boolean
}

export interface CTERef {
  name: string
  /** Column names if explicitly defined in CTE */
  columns: string[]
}

export interface ScopeInfo {
  /** Tables available in current scope */
  availableTables: TableRef[]
  /** Columns available in current scope (from all tables) */
  availableColumns: ColumnRef[]
  /** CTEs defined before current position */
  ctes: CTERef[]

  /** Resolved columns per table (populated when pg_query parse succeeds) */
  resolvedColumns: Map<string, ColumnRef[]>
  /** Whether pg_query parsing succeeded for scope analysis */
  isPgQueryValid: boolean
}

// ============================================================================
// 5. CANDIDATE GENERATOR TYPES
// ============================================================================

export type CandidateType =
  | 'column'
  | 'table'
  | 'view'
  | 'keyword'
  | 'function'
  | 'procedure'
  | 'alias'
  | 'cte'
  | 'schema'
  | 'operator'

export interface Candidate {
  type: CandidateType
  /** The text value to match/insert */
  value: string
  /** Display text (may differ from value, e.g., qualified name) */
  displayText: string
  /** Additional info (e.g., column type, function signature) */
  detail?: string
  /** Text to insert if different from value (e.g., with parens for functions) */
  insertText?: string
  /** Source of this candidate */
  source: 'schema' | 'context' | 'keyword' | 'function' | 'system'
}

// ============================================================================
// 6. RANKER TYPES
// ============================================================================

export type MatchType = 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'none'

export interface RankedSuggestion extends Candidate {
  /** Computed relevance score */
  score: number
  /** How the partial token matched this candidate */
  matchType: MatchType
}

export interface RankingConfig {
  /** Boost recently used items */
  recencyBoost: boolean
  /** Preferred order by candidate type */
  typePreference: CandidateType[]
  /** Boost columns from selected/focused table */
  boostSelectedTable: boolean
}

// ============================================================================
// SCHEMA TYPES (input to pipeline)
// ============================================================================

export interface SchemaTable {
  schema: string
  name: string
  type: 'table' | 'view'
  columns: SchemaColumn[]
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
}

export interface SchemaFunction {
  schema: string
  name: string
  signature: string
  returnType: string
  kind?: 'function' | 'procedure'
}

export interface SchemaInfo {
  defaultSchema: string
  tables: SchemaTable[]
  functions: SchemaFunction[]
  /** Currently selected table in UI (for boosting) */
  selectedTable?: { schema: string; name: string }
  /** PostgreSQL version (e.g., 14, 15, 16) for filtering system functions */
  pgVersion?: number
}

// ============================================================================
// PIPELINE INPUT/OUTPUT
// ============================================================================

export interface AutocompleteInput {
  sql: string
  cursorPosition: number
  schema: SchemaInfo
}

export interface AutocompleteOutput {
  suggestions: RankedSuggestion[]
  context: CursorContext
  timing?: {
    tokenize: number
    parse: number
    detectSection: number
    analyzeScope: number
    generateCandidates: number
    rank: number
    total: number
  }
}

// ============================================================================
// PARSER INJECTION TYPES (for testability)
// ============================================================================

/**
 * Interface for pg_query parser dependency.
 * Allows injection of mock parsers for testing.
 */
export interface PgQueryParser {
  parseSync: (sql: string) => unknown
  scanSync: (sql: string) => { tokens: ScanToken[] }
  isLoaded: () => boolean
}

/**
 * Token from pg_query scanner.
 */
export interface ScanToken {
  start: number
  end: number
  tokenName: string
  keywordKind: number
}

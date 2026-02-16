// Core types
export type {
  ParsedSql,
  Statement,
  SelectStmt,
  InsertStmt,
  UpdateStmt,
  DeleteStmt,
  CreateTableStmt,
  AlterTableStmt,
  DropStmt,
  CreateViewStmt,
  CreateIndexStmt,
  CreateFunctionStmt,
  TruncateStmt,
  UnknownStmt,
  Expr,
  ColumnRef,
  Literal,
  FuncCall,
  BinaryOp,
  UnaryOp,
  SubLink,
  CaseExpr,
  TypeCast,
  NullTest,
  ArrayExpr,
  CoalesceExpr,
  ParamRef,
  UnknownExpr,
  FromClause,
  TableRef,
  SubqueryRef,
  JoinExpr,
  SortExpr,
  WindowDef,
  CTE,
  SetOperation,
  TargetExpr,
} from './core'

// Core functions
export { parseSql, ensureModuleLoaded, isModuleLoaded } from './core'

// DDL detection
const DDL_KINDS = new Set([
  'create_table',
  'alter_table',
  'drop',
  'create_view',
  'create_index',
  'create_function',
  'truncate',
])

export function isDDLStatement(kind: string): boolean {
  return DDL_KINDS.has(kind)
}

// Format functions
export { formatSql, formatSqlOneLine } from './format'

// Editor functions and types
export { getEditorInfo } from './editor'
export type { StatementRange, FoldRegion, EditorInfo } from './editor'

// Tokenizer functions and types
export { tokenize } from './tokenizer'
export type { TokenRange } from './tokenizer'

// Completions data and functions
export * from './completions'

// Modern autocomplete pipeline
export { autocomplete, isMatch } from './autocomplete'
export type {
  SchemaInfo,
  SchemaTable,
  SchemaColumn,
  RankedSuggestion,
  SQLSection,
  CandidateType,
} from './autocomplete'

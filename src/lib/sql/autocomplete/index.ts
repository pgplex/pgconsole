/**
 * SQL Autocomplete Pipeline
 *
 * A modular autocomplete system for PostgreSQL with:
 * - Error-tolerant parsing (handles incomplete SQL)
 * - Context-aware section detection
 * - Scope analysis (tables, columns, CTEs)
 * - Intelligent candidate generation and ranking
 *
 * @example
 * ```ts
 * import { autocomplete } from './autocomplete'
 *
 * const result = autocomplete(
 *   'SELECT | FROM users',
 *   7, // cursor at |
 *   schema
 * )
 *
 * console.log(result.suggestions) // [{ value: 'id', type: 'column', ... }, ...]
 * console.log(result.context.section) // 'SELECT_COLUMNS'
 * ```
 */

// Pipeline
export { runAutocompletePipeline, createPipeline, autocomplete } from './pipeline'
export type { PipelineOptions } from './pipeline'

// Types
export type {
  // Token types
  Token,
  TokenType,
  TokenizedSQL,
  ScanToken,
  // Syntax tree types
  SyntaxNode,
  SyntaxTree,
  // Context types
  SQLSection,
  StatementType,
  CursorContext,
  // Scope types
  TableRef,
  ColumnRef,
  CTERef,
  ScopeInfo,
  // Candidate types
  CandidateType,
  Candidate,
  MatchType,
  RankedSuggestion,
  RankingConfig,
  // Schema types
  SchemaInfo,
  SchemaTable,
  SchemaColumn,
  SchemaFunction,
  // Input/Output types
  AutocompleteInput,
  AutocompleteOutput,
  // Parser injection types
  PgQueryParser,
} from './types'

// Module functions (for unit testing and advanced usage)
export { tokenize, getTokensUpToCursor, getPartialToken, isInsideStringOrComment } from './tokenizer'
export type { TokenizerOptions } from './tokenizer'
export { parseFromTokens, findClauseAtPosition, findStatementAtPosition, extractCurrentStatement } from './parser'
export { detectSection, isExpectingAlias } from './section-detector'
export { analyzeScope, resolveAlias, getColumnsForTable, findTableInSchema } from './scope-analyzer'
export type { ScopeAnalyzerOptions } from './scope-analyzer'
export { generateCandidates, getInsertText } from './candidate-generator'
export {
  rankCandidates,
  deduplicateCandidates,
  limitSuggestions,
  groupSuggestionsByType,
  computeMatchType,
  isMatch,
} from './ranker'

// System functions
export { PG_SYSTEM_FUNCTIONS } from '../pg-system-functions'
export type {
  SystemFunction,
  SystemFunctionSignature,
  SystemFunctionCategory,
} from '../pg-system-functions'

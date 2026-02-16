/**
 * Autocomplete Pipeline Orchestrator
 *
 * Coordinates all modules to produce autocomplete suggestions:
 * SQL + Cursor → Tokenize → Parse → DetectSection → AnalyzeScope → GenerateCandidates → Rank
 */

import type {
  AutocompleteInput,
  AutocompleteOutput,
  SchemaInfo,
  RankingConfig,
  PgQueryParser,
} from './types'
import { tokenize, getPartialToken, isInsideStringOrComment } from './tokenizer'
import { parseFromTokens } from './parser'
import { detectSection } from './section-detector'
import { analyzeScope } from './scope-analyzer'
import { generateCandidates } from './candidate-generator'
import { rankCandidates, deduplicateCandidates, isMatch } from './ranker'

export interface PipelineOptions {
  /** Ranking configuration */
  rankingConfig?: Partial<RankingConfig>
  /** Enable timing measurements */
  measureTiming?: boolean
  /** Custom parser for testing (injectable dependency) */
  parser?: PgQueryParser
}

const DEFAULT_OPTIONS: Omit<Required<PipelineOptions>, 'parser'> = {
  rankingConfig: {},
  measureTiming: false,
}

/**
 * Run the complete autocomplete pipeline.
 */
export function runAutocompletePipeline(
  input: AutocompleteInput,
  options?: PipelineOptions
): AutocompleteOutput {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const timing: AutocompleteOutput['timing'] = opts.measureTiming
    ? {
        tokenize: 0,
        parse: 0,
        detectSection: 0,
        analyzeScope: 0,
        generateCandidates: 0,
        rank: 0,
        total: 0,
      }
    : undefined

  const totalStart = opts.measureTiming ? performance.now() : 0

  // 1. Tokenize
  const tokenizeStart = opts.measureTiming ? performance.now() : 0
  const tokenized = tokenize(input.sql, input.cursorPosition, {
    parser: opts.parser,
  })
  if (timing) timing.tokenize = performance.now() - tokenizeStart

  // Check for string/comment early exit
  if (isInsideStringOrComment(tokenized, input.cursorPosition, input.sql)) {
    return {
      suggestions: [],
      context: {
        section: 'UNKNOWN',
        statementType: 'UNKNOWN',
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
      },
      timing,
    }
  }

  // 2. Parse (build syntax tree)
  const parseStart = opts.measureTiming ? performance.now() : 0
  const tree = parseFromTokens(tokenized, input.sql)
  if (timing) timing.parse = performance.now() - parseStart

  // 3. Detect section
  const detectStart = opts.measureTiming ? performance.now() : 0
  const context = detectSection(tokenized, tree, input.cursorPosition, input.sql)
  if (timing) timing.detectSection = performance.now() - detectStart

  // 4. Analyze scope
  const scopeStart = opts.measureTiming ? performance.now() : 0
  const scope = analyzeScope(context, tokenized, tree, input.sql, input.schema, {
    parser: opts.parser,
  })
  if (timing) timing.analyzeScope = performance.now() - scopeStart

  // 5. Generate candidates
  const generateStart = opts.measureTiming ? performance.now() : 0
  let candidates = generateCandidates(context, scope, input.schema)

  // Filter by partial token if present
  // Use tokenizer's partial, or fall back to context's partialToken (for keywords typed as identifiers)
  const partial = getPartialToken(tokenized) || context.partialToken
  if (partial) {
    candidates = candidates.filter((c) => isMatch(c.value, partial))
  }
  if (timing) timing.generateCandidates = performance.now() - generateStart

  // 6. Rank candidates
  const rankStart = opts.measureTiming ? performance.now() : 0
  let ranked = rankCandidates(
    candidates,
    context,
    partial,
    input.schema,
    opts.rankingConfig
  )

  // Deduplicate (no limit - let display layer handle that)
  ranked = deduplicateCandidates(ranked)
  if (timing) timing.rank = performance.now() - rankStart

  if (timing) timing.total = performance.now() - totalStart

  return {
    suggestions: ranked,
    context,
    timing,
  }
}

/**
 * Create a configured pipeline runner.
 */
export function createPipeline(defaultOptions?: PipelineOptions) {
  return (input: AutocompleteInput, overrideOptions?: PipelineOptions) => {
    return runAutocompletePipeline(input, { ...defaultOptions, ...overrideOptions })
  }
}

/**
 * Convenience function for quick autocomplete.
 */
export function autocomplete(
  sql: string,
  cursorPosition: number,
  schema: SchemaInfo
): AutocompleteOutput {
  return runAutocompletePipeline({ sql, cursorPosition, schema })
}

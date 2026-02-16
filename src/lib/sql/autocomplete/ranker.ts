/**
 * Ranker Module
 *
 * Follows VSCode's ranking strategy:
 * - When user is typing (has partial match), match quality is PRIMARY criterion
 * - Match tiers: exact > prefix > contains > fuzzy (never cross tiers)
 * - Within same tier, use context/type bonuses as tiebreakers
 * - When no partial typed, fall back to pure context-based ordering
 *
 * Reference: https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/suggest/browser/completionModel.ts
 */

import type {
  Candidate,
  CandidateType,
  CursorContext,
  RankedSuggestion,
  RankingConfig,
  MatchType,
  SchemaInfo,
  SQLSection,
} from './types'

// Match type tier multipliers - creates non-overlapping score ranges
// Each tier is separated by 10000 points, ensuring match quality always wins
const MATCH_TIER = {
  exact: 40000,
  prefix: 30000,
  contains: 20000,
  fuzzy: 10000,
  none: 0, // No partial typed - pure context ordering
}

// Default type priority order (higher index = lower priority)
const DEFAULT_TYPE_PRIORITY: CandidateType[] = [
  'column',
  'cte',
  'table',
  'view',
  'function',
  'keyword',
  'alias',
  'schema',
  'operator',
]

// Statement keyword priority (higher value = higher priority)
// Based on frequency of use - SELECT is most common
const STATEMENT_KEYWORD_PRIORITY: Record<string, number> = {
  SELECT: 100,
  WITH: 90,
  INSERT: 80,
  UPDATE: 70,
  DELETE: 60,
  CREATE: 50,
  ALTER: 40,
  DROP: 30,
  TRUNCATE: 20,
}

// CREATE object type priority (higher value = higher priority)
const CREATE_OBJECT_PRIORITY: Record<string, number> = {
  'TABLE': 100, 'TABLE IF NOT EXISTS': 95, 'TEMP TABLE': 90, 'UNLOGGED TABLE': 85,
  'INDEX': 80, 'UNIQUE INDEX': 78, 'INDEX CONCURRENTLY': 76,
  'VIEW': 70, 'OR REPLACE VIEW': 68, 'MATERIALIZED VIEW': 66,
  'FUNCTION': 60, 'OR REPLACE FUNCTION': 58, 'PROCEDURE': 55, 'OR REPLACE PROCEDURE': 53,
  'TRIGGER': 50, 'SCHEMA': 45, 'DATABASE': 43, 'SEQUENCE': 40,
  'TYPE': 35, 'DOMAIN': 33, 'EXTENSION': 30, 'EXTENSION IF NOT EXISTS': 28,
  'ROLE': 25, 'USER': 23, 'POLICY': 20, 'PUBLICATION': 15, 'SUBSCRIPTION': 10,
}

// Context score weights (all bonuses combined must stay under 10000 to not cross tiers)
const CONTEXT_WEIGHTS = {
  typeBonus: 50, // Per position in priority list (max ~450)
  selectedTableBonus: 200, // Columns from selected table
  defaultSchemaBonus: 100, // Tables from default schema
  // Section bonuses 0-600, keyword bonuses 0-500, source priority 0-100, common fn boost 0-200
  // Max theoretical context score: ~450 + 200 + 100 + 100 + 200 + 600 = 1650 (well under 10000)
}

// Source priority for ranking (higher = more relevant)
const SOURCE_PRIORITY: Record<string, number> = {
  context: 100,  // CTEs, aliases from current query
  schema: 80,    // User-defined tables, functions
  system: 60,    // PostgreSQL built-in functions
  function: 40,  // Legacy
  keyword: 20,   // SQL keywords
}

// Common function boost - frequently used PostgreSQL functions get priority
// Higher value = more commonly used (max 200 to stay within context score budget)
const COMMON_FUNCTION_BOOST: Record<string, number> = {
  // Null handling (extremely common)
  coalesce: 200,
  nullif: 150,
  greatest: 120,
  least: 120,

  // Aggregates (extremely common)
  count: 200,
  sum: 200,
  avg: 180,
  min: 180,
  max: 180,
  array_agg: 150,
  string_agg: 150,
  json_agg: 140,
  jsonb_agg: 140,

  // String functions (very common)
  concat: 180,
  lower: 170,
  upper: 170,
  trim: 160,
  length: 160,
  substring: 150,
  replace: 150,
  split_part: 140,
  left: 130,
  right: 130,
  regexp_replace: 120,

  // Date/Time (very common)
  now: 200,
  current_timestamp: 180,
  current_date: 170,
  date_trunc: 160,
  extract: 160,
  age: 140,
  to_char: 150,
  to_date: 140,
  to_timestamp: 140,

  // Window functions (common)
  row_number: 170,
  rank: 160,
  dense_rank: 150,
  lag: 150,
  lead: 150,
  first_value: 130,
  last_value: 130,

  // JSON (increasingly common)
  jsonb_build_object: 160,
  json_build_object: 150,
  to_jsonb: 140,
  to_json: 130,
  jsonb_extract_path_text: 130,

  // Type conversion
  cast: 180,

  // Utility
  generate_series: 160,
  pg_sleep: 120,
  exists: 150,
}

// Section-specific bonuses by candidate type
// Maps each SQL section to candidate type bonuses for context-aware ranking
const SECTION_BONUSES: Partial<Record<SQLSection, Partial<Record<CandidateType, number>>>> = {
  // SELECT columns: columns most relevant, then functions
  SELECT_COLUMNS: { column: 300, function: 250 },

  // Table contexts: CTEs highest (local), then tables/views
  FROM_TABLE: { cte: 350, table: 300, view: 300 },
  JOIN_TABLE: { cte: 350, table: 300, view: 300 },
  INSERT_TABLE: { cte: 350, table: 300, view: 300 },
  UPDATE_TABLE: { cte: 350, table: 300, view: 300 },
  DELETE_TABLE: { cte: 350, table: 300, view: 300 },

  // Condition contexts: columns most relevant, keywords secondary
  WHERE_CONDITION: { column: 300, function: 200, keyword: 100 },
  JOIN_CONDITION: { column: 300, function: 200, keyword: 100 },
  HAVING: { column: 300, function: 250, keyword: 100 },

  // GROUP BY: columns highest, then advanced keywords (ROLLUP, CUBE)
  GROUP_BY: { column: 300, function: 150 },

  // ORDER BY: columns highest, then modifiers (ASC, DESC)
  ORDER_BY: { column: 300, function: 150 },

  // Update SET: columns from target table
  UPDATE_SET: { column: 300 },
}

// Keywords that should be boosted in specific contexts
const CONTEXT_BOOSTED_KEYWORDS: Partial<Record<SQLSection, Set<string>>> = {
  ORDER_BY: new Set(['ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST', 'LIMIT']),
  GROUP_BY: new Set(['ROLLUP', 'CUBE', 'GROUPING SETS', 'HAVING']),
  SELECT_COLUMNS: new Set(['DISTINCT', 'ALL', 'AS', 'CASE']),
  WHERE_CONDITION: new Set(['AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL']),
  JOIN_CONDITION: new Set(['AND', 'OR']),
}

// Clause transition keywords - lower priority when user is typing an expression
const CLAUSE_TRANSITION_KEYWORDS = new Set([
  'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
  'UNION', 'INTERSECT', 'EXCEPT', 'WINDOW', 'FOR UPDATE', 'FOR SHARE',
])

/**
 * Rank candidates based on partial match and context.
 *
 * Scoring strategy (following VSCode):
 * - score = MATCH_TIER[matchType] + contextScore
 * - Match tier ensures match quality always wins (exact > prefix > contains > fuzzy)
 * - Context score only matters within the same match tier
 */
export function rankCandidates(
  candidates: Candidate[],
  context: CursorContext,
  partialMatch: string | null,
  schema: SchemaInfo,
  config?: Partial<RankingConfig>
): RankedSuggestion[] {
  const effectiveConfig: RankingConfig = {
    recencyBoost: config?.recencyBoost ?? false,
    typePreference: config?.typePreference ?? DEFAULT_TYPE_PRIORITY,
    boostSelectedTable: config?.boostSelectedTable ?? true,
  }

  const rankedCandidates: RankedSuggestion[] = candidates.map((candidate) => {
    const matchType = computeMatchType(candidate.value, partialMatch)
    const score = computeScore(candidate, matchType, partialMatch, context, schema, effectiveConfig)

    return {
      ...candidate,
      score,
      matchType,
    }
  })

  // Filter out non-matches if we have a partial
  const filtered = partialMatch
    ? rankedCandidates.filter((c) => c.matchType !== 'none')
    : rankedCandidates

  // Sort by score descending, then alphabetically
  return filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.value.localeCompare(b.value)
  })
}

/**
 * Compute match type between candidate value and partial input.
 * Exported for use by other autocomplete integrations.
 */
export function computeMatchType(value: string, partial: string | null): MatchType {
  if (!partial) return 'none'

  const valueLower = value.toLowerCase()
  const partialLower = partial.toLowerCase()

  // Exact match
  if (valueLower === partialLower) {
    return 'exact'
  }

  // Prefix match
  if (valueLower.startsWith(partialLower)) {
    return 'prefix'
  }

  // Contains match
  if (valueLower.includes(partialLower)) {
    return 'contains'
  }

  // Fuzzy match (simplified: all characters in order)
  if (fuzzyMatch(valueLower, partialLower)) {
    return 'fuzzy'
  }

  return 'none'
}

/**
 * Simple fuzzy matching: all characters of pattern appear in value in order.
 */
function fuzzyMatch(value: string, pattern: string): boolean {
  let patternIdx = 0

  for (let i = 0; i < value.length && patternIdx < pattern.length; i++) {
    if (value[i] === pattern[patternIdx]) {
      patternIdx++
    }
  }

  return patternIdx === pattern.length
}

/**
 * Check if a value matches a partial pattern.
 * Returns true if there's any match (exact, prefix, contains, or fuzzy).
 */
export function isMatch(value: string, partial: string | null): boolean {
  return computeMatchType(value, partial) !== 'none'
}

/**
 * Compute score for a candidate.
 *
 * Score = matchTier + contextScore
 * - matchTier: 40000/30000/20000/10000/0 for exact/prefix/contains/fuzzy/none
 * - contextScore: type priority + section bonus + other context bonuses (0-2000 range)
 */
function computeScore(
  candidate: Candidate,
  matchType: MatchType,
  _partialMatch: string | null,
  context: CursorContext,
  schema: SchemaInfo,
  config: RankingConfig
): number {
  // Start with match tier - this is the PRIMARY criterion when typing
  const matchTier = MATCH_TIER[matchType]

  // Compute context score (tiebreaker within same match tier)
  const contextScore = computeContextScore(candidate, context, schema, config)

  return matchTier + contextScore
}

/**
 * Compute context-based score (used as tiebreaker within match tiers).
 */
function computeContextScore(
  candidate: Candidate,
  context: CursorContext,
  schema: SchemaInfo,
  config: RankingConfig
): number {
  let score = 0

  // Type priority bonus
  const typeIndex = config.typePreference.indexOf(candidate.type)
  if (typeIndex !== -1) {
    // Higher priority (lower index) = higher bonus
    score += (config.typePreference.length - typeIndex) * CONTEXT_WEIGHTS.typeBonus
  }

  // Selected table bonus for columns
  if (config.boostSelectedTable && candidate.type === 'column' && schema.selectedTable) {
    const detail = candidate.detail || ''
    const selectedTableName = schema.selectedTable.name.toLowerCase()
    if (detail.toLowerCase().startsWith(selectedTableName + '.')) {
      score += CONTEXT_WEIGHTS.selectedTableBonus
    }
  }

  // Default schema bonus for tables
  if ((candidate.type === 'table' || candidate.type === 'view') && schema.defaultSchema) {
    if (!candidate.value.includes('.')) {
      score += CONTEXT_WEIGHTS.defaultSchemaBonus
    }
  }

  // Source priority bonus
  const sourcePriority = SOURCE_PRIORITY[candidate.source] || 0
  score += sourcePriority

  // Common function boost for system functions
  if (candidate.source === 'system' && candidate.type === 'function') {
    const commonBoost = COMMON_FUNCTION_BOOST[candidate.value.toLowerCase()] || 0
    score += commonBoost
  }

  // Section-specific bonuses
  score += getSectionBonus(candidate, context)

  return score
}

/**
 * Get bonus score based on current section.
 */
function getSectionBonus(candidate: Candidate, context: CursorContext): number {
  const { section, isAfterCompletedIdentifier } = context

  // Special case: STATEMENT_START uses keyword priority ordering
  if (section === 'STATEMENT_START') {
    if (candidate.type === 'keyword') {
      const priority = STATEMENT_KEYWORD_PRIORITY[candidate.value.toUpperCase()] || 0
      return 300 + priority
    }
    return 0
  }

  // Special case: CREATE_OBJECT uses object type priority ordering
  if (section === 'CREATE_OBJECT') {
    if (candidate.type === 'keyword') {
      const priority = CREATE_OBJECT_PRIORITY[candidate.value.toUpperCase()] || 0
      return 300 + priority
    }
    return 0
  }

  // Special case: Operators after completed identifier in WHERE/HAVING/JOIN_CONDITION
  if (candidate.type === 'operator' && isAfterCompletedIdentifier) {
    if (section === 'WHERE_CONDITION' || section === 'JOIN_CONDITION' || section === 'HAVING') {
      return 600 // Highest context priority - most common after column name
    }
  }

  // For keywords, apply context-specific logic
  if (candidate.type === 'keyword') {
    return getKeywordBonus(candidate.value, context)
  }

  // Data-driven lookup for non-keywords
  const sectionBonuses = SECTION_BONUSES[section]
  if (sectionBonuses) {
    let bonus = sectionBonuses[candidate.type] ?? 0

    // Reduce bonus for columns/tables when user has completed an identifier
    // without a comma - they likely want clause transitions instead
    if (isAfterCompletedIdentifier) {
      if (candidate.type === 'column' || candidate.type === 'table' ||
          candidate.type === 'view' || candidate.type === 'cte') {
        bonus = Math.min(bonus, 100) // Cap to rank below clause transitions
      }
    }

    return bonus
  }

  return 0
}

// Expression operator keywords - these follow an identifier in WHERE/HAVING
const EXPRESSION_OPERATOR_KEYWORDS = new Set([
  'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS',
  'BETWEEN', 'NOT BETWEEN', 'BETWEEN SYMMETRIC',
  'LIKE', 'NOT LIKE', 'ILIKE', 'NOT ILIKE',
  'SIMILAR TO', 'NOT SIMILAR TO',
  'IS NULL', 'IS NOT NULL',
  'IS TRUE', 'IS NOT TRUE',
  'IS FALSE', 'IS NOT FALSE',
  'IS UNKNOWN', 'IS NOT UNKNOWN',
  'IS DISTINCT FROM', 'IS NOT DISTINCT FROM',
])

// Logical connector keywords - connect conditions
const LOGICAL_CONNECTOR_KEYWORDS = new Set(['AND', 'OR'])

/**
 * Get bonus for a keyword based on current section context.
 */
function getKeywordBonus(keyword: string, context: CursorContext): number {
  const keywordUpper = keyword.toUpperCase()
  const { section, isAfterCompletedIdentifier, isAfterCompletedExpression } = context

  // In WHERE/HAVING/JOIN_CONDITION, expression operator keywords should rank high
  if (section === 'WHERE_CONDITION' || section === 'JOIN_CONDITION' || section === 'HAVING') {
    // After completed expression (col = val): AND/OR are highest priority
    if (isAfterCompletedExpression) {
      if (LOGICAL_CONNECTOR_KEYWORDS.has(keywordUpper)) {
        return 500
      }
      if (CLAUSE_TRANSITION_KEYWORDS.has(keywordUpper)) {
        return 400
      }
      return 100
    }

    // After completed identifier (col): operators are highest priority
    if (isAfterCompletedIdentifier) {
      if (EXPRESSION_OPERATOR_KEYWORDS.has(keywordUpper)) {
        return 450
      }
      if (LOGICAL_CONNECTOR_KEYWORDS.has(keywordUpper)) {
        return 350
      }
      if (CLAUSE_TRANSITION_KEYWORDS.has(keywordUpper)) {
        return 250
      }
    }

    // Default: typing partial match
    if (EXPRESSION_OPERATOR_KEYWORDS.has(keywordUpper)) {
      return 400
    }
    if (LOGICAL_CONNECTOR_KEYWORDS.has(keywordUpper)) {
      return 300
    }
    if (CLAUSE_TRANSITION_KEYWORDS.has(keywordUpper)) {
      return 100
    }
  }

  // Check if this keyword is boosted in the current context
  const boostedKeywords = CONTEXT_BOOSTED_KEYWORDS[section]
  if (boostedKeywords?.has(keywordUpper)) {
    return 200
  }

  // Clause transition keywords handling
  if (CLAUSE_TRANSITION_KEYWORDS.has(keywordUpper)) {
    if (isAfterCompletedIdentifier) {
      switch (section) {
        case 'SELECT_COLUMNS':
          if (keywordUpper === 'FROM') return 400
          if (keywordUpper === 'WHERE') return 350
          return 300
        case 'FROM_TABLE':
          if (keywordUpper === 'WHERE') return 400
          if (keywordUpper === 'ORDER BY') return 350
          if (keywordUpper === 'GROUP BY') return 350
          return 300
        default:
          return 300
      }
    }

    // Not after completed identifier - clause transitions get lower priority
    switch (section) {
      case 'SELECT_COLUMNS':
        return 50
      case 'ORDER_BY':
        if (keywordUpper === 'LIMIT' || keywordUpper === 'OFFSET') {
          return 150
        }
        return 30
      case 'GROUP_BY':
        if (keywordUpper === 'HAVING') {
          return 180
        }
        return 30
      case 'WHERE_CONDITION':
      case 'HAVING':
        if (['ORDER BY', 'GROUP BY', 'LIMIT'].includes(keywordUpper)) {
          return 100
        }
        return 30
      default:
        return 50
    }
  }

  // Default keyword bonus
  return 80
}

/**
 * Deduplicate candidates by value, keeping highest scored.
 */
export function deduplicateCandidates(candidates: RankedSuggestion[]): RankedSuggestion[] {
  const seen = new Map<string, RankedSuggestion>()

  for (const candidate of candidates) {
    const key = candidate.value.toLowerCase()
    const existing = seen.get(key)

    if (!existing || candidate.score > existing.score) {
      seen.set(key, candidate)
    }
  }

  return Array.from(seen.values())
}

/**
 * Limit the number of suggestions returned.
 */
export function limitSuggestions(
  suggestions: RankedSuggestion[],
  limit: number = 50
): RankedSuggestion[] {
  return suggestions.slice(0, limit)
}

/**
 * Group suggestions by type for display.
 */
export function groupSuggestionsByType(
  suggestions: RankedSuggestion[]
): Map<CandidateType, RankedSuggestion[]> {
  const groups = new Map<CandidateType, RankedSuggestion[]>()

  for (const suggestion of suggestions) {
    const existing = groups.get(suggestion.type) || []
    existing.push(suggestion)
    groups.set(suggestion.type, existing)
  }

  return groups
}

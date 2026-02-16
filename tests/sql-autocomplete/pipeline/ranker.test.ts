// tests/sql-autocomplete/pipeline/ranker.test.ts

import { describe, it, expect } from 'vitest'
import {
  rankCandidates,
  deduplicateCandidates,
  limitSuggestions,
  groupSuggestionsByType,
  computeMatchType,
  isMatch,
} from '../../../src/lib/sql/autocomplete/ranker'
import type {
  Candidate,
  CandidateType,
  CursorContext,
  SchemaInfo,
  RankedSuggestion,
  SQLSection,
} from '../../../src/lib/sql/autocomplete/types'

// ============================================================================
// TEST HELPERS
// ============================================================================

function createContext(section: SQLSection): CursorContext {
  return {
    section,
    statementType: 'SELECT',
    isAtKeywordBoundary: false,
    isAfterComma: false,
    isAfterOperator: false,
    partialToken: null,
    tablePrefix: null,
    depth: 0,
    parentContext: null,
    containingNode: null,
  }
}

function c(
  value: string,
  type: CandidateType,
  source: Candidate['source'] = 'schema',
  detail?: string
): Candidate {
  return { type, value, displayText: value, source, detail }
}

const defaultSchema: SchemaInfo = {
  defaultSchema: 'public',
  tables: [],
  functions: [],
}

// ============================================================================
// TEST CASE TYPES
// ============================================================================

interface RankTestCase {
  name: string
  strategy: string // Scoring strategy being tested, shown on failure
  candidates: Candidate[]
  schema?: SchemaInfo
  expected: string[]
}

// ============================================================================
// TEST DATA - Organized by section
// ============================================================================

const selectColumnsTests: RankTestCase[] = [
  {
    name: 'columns rank before functions',
    strategy: 'SECTION_BONUS: column +300 vs function +200',
    candidates: [c('COUNT', 'function'), c('id', 'column')],
    expected: ['id', 'COUNT'],
  },
  {
    name: 'columns rank before tables',
    strategy: 'SECTION_BONUS: column +300 vs table +0',
    candidates: [c('users', 'table'), c('id', 'column')],
    expected: ['id', 'users'],
  },
  {
    name: 'context source boosted over schema source',
    strategy: 'CONTEXT_SOURCE_BONUS: context +50 vs schema +0',
    candidates: [c('id', 'column', 'schema'), c('name', 'column', 'context')],
    expected: ['name', 'id'],
  },
  {
    name: 'selected table columns boosted',
    strategy: 'SELECTED_TABLE_BONUS: matching table column +200',
    candidates: [
      c('id', 'column', 'context', 'orders.integer'),
      c('user_id', 'column', 'context', 'users.integer'),
    ],
    schema: {
      ...defaultSchema,
      selectedTable: { schema: 'public', name: 'users' },
    },
    expected: ['user_id', 'id'],
  },
]

const fromTableTests: RankTestCase[] = [
  {
    name: 'tables rank before columns',
    strategy: 'SECTION_BONUS: table +300 vs column +0',
    candidates: [c('id', 'column'), c('users', 'table')],
    expected: ['users', 'id'],
  },
  {
    name: 'tables rank before keywords',
    strategy: 'SECTION_BONUS: table +300 vs keyword +0',
    candidates: [c('WHERE', 'keyword'), c('users', 'table')],
    expected: ['users', 'WHERE'],
  },
  {
    name: 'CTEs rank highest',
    strategy: 'SECTION_BONUS: cte +350 vs table +300',
    candidates: [c('users', 'table'), c('active_users', 'cte')],
    expected: ['active_users', 'users'],
  },
  {
    name: 'default schema tables boosted over qualified',
    strategy: 'DEFAULT_SCHEMA_BONUS: unqualified +100 vs qualified +0',
    candidates: [c('auth.sessions', 'table'), c('users', 'table')],
    expected: ['users', 'auth.sessions'],
  },
]

const whereConditionTests: RankTestCase[] = [
  {
    name: 'columns rank before functions',
    strategy: 'SECTION_BONUS: column +300 vs function +0',
    candidates: [c('COUNT', 'function'), c('id', 'column')],
    expected: ['id', 'COUNT'],
  },
  {
    name: 'columns rank before keywords',
    strategy: 'SECTION_BONUS: column +300 vs keyword +100',
    candidates: [c('AND', 'keyword'), c('status', 'column')],
    expected: ['status', 'AND'],
  },
]

const orderByTests: RankTestCase[] = [
  {
    name: 'columns rank before keywords',
    strategy: 'SECTION_BONUS: column +300 vs keyword +0',
    candidates: [c('ASC', 'keyword'), c('created_at', 'column')],
    expected: ['created_at', 'ASC'],
  },
]

const groupByTests: RankTestCase[] = [
  {
    name: 'columns rank before keywords',
    strategy: 'SECTION_BONUS: column +300 vs keyword +0',
    candidates: [c('HAVING', 'keyword'), c('status', 'column')],
    expected: ['status', 'HAVING'],
  },
]

const statementStartTests: RankTestCase[] = [
  {
    name: 'keywords rank before tables',
    strategy: 'SECTION_BONUS: keyword +300 vs table +0',
    candidates: [c('users', 'table'), c('SELECT', 'keyword')],
    expected: ['SELECT', 'users'],
  },
]

const generalTests: RankTestCase[] = [
  {
    name: 'alphabetical sort when scores equal',
    strategy: 'TIEBREAKER: alphabetical when scores equal',
    candidates: [
      c('zebra', 'column', 'schema'),
      c('apple', 'column', 'schema'),
      c('mango', 'column', 'schema'),
    ],
    expected: ['apple', 'mango', 'zebra'],
  },
]

// ============================================================================
// TEST RUNNER
// ============================================================================

function runRankTests(section: SQLSection, tests: RankTestCase[]) {
  for (const tc of tests) {
    it(tc.name, () => {
      const context = createContext(section)
      const schema = tc.schema ?? defaultSchema
      const ranked = rankCandidates(tc.candidates, context, null, schema)
      const actual = ranked.map((r) => r.value)

      // Include strategy in error message for debugging
      expect(actual, `Strategy: ${tc.strategy}`).toEqual(tc.expected)
    })
  }
}

// ============================================================================
// TEST DATA - Partial filtering
// ============================================================================

interface PartialFilterTestCase {
  name: string
  candidates: Candidate[]
  partial: string
  expected: string[]
}

const partialFilterTests: PartialFilterTestCase[] = [
  {
    name: 'filters non-matches, all match types have equal weight',
    candidates: [c('user_id', 'column'), c('id', 'column'), c('name', 'column')],
    partial: 'id',
    expected: ['id', 'user_id'], // 'name' filtered out, alphabetical tiebreaker
  },
  {
    name: 'includes fuzzy matches with equal weight',
    candidates: [c('user_account', 'column'), c('created_at', 'column'), c('ua_code', 'column')],
    partial: 'ua',
    expected: ['ua_code', 'user_account'], // 'created_at' filtered out
  },
]

// ============================================================================
// TEST DATA - computeMatchType
// ============================================================================

interface MatchTypeTestCase {
  value: string
  partial: string | null
  expected: 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'none'
}

const matchTypeTests: MatchTypeTestCase[] = [
  // Exact matches
  { value: 'user_id', partial: 'user_id', expected: 'exact' },
  { value: 'User_ID', partial: 'user_id', expected: 'exact' }, // case-insensitive
  // Prefix matches
  { value: 'user_id', partial: 'user', expected: 'prefix' },
  { value: 'created_at', partial: 'crea', expected: 'prefix' },
  // Contains matches
  { value: 'user_id', partial: 'id', expected: 'contains' },
  { value: 'created_at', partial: 'ate', expected: 'contains' },
  // Fuzzy matches
  { value: 'user_account', partial: 'ua', expected: 'fuzzy' },
  { value: 'created_at', partial: 'cat', expected: 'fuzzy' },
  // No matches
  { value: 'user_id', partial: 'xyz', expected: 'none' },
  { value: 'created_at', partial: 'zzz', expected: 'none' },
  { value: 'user_id', partial: null, expected: 'none' },
]

// ============================================================================
// TEST DATA - isMatch
// ============================================================================

interface IsMatchTestCase {
  value: string
  partial: string | null
  expected: boolean
}

const isMatchTests: IsMatchTestCase[] = [
  // True cases (any match type)
  { value: 'user_id', partial: 'user_id', expected: true },  // exact
  { value: 'user_id', partial: 'user', expected: true },     // prefix
  { value: 'user_id', partial: 'id', expected: true },       // contains
  { value: 'user_account', partial: 'ua', expected: true },  // fuzzy
  { value: 'User_ID', partial: 'user', expected: true },     // case-insensitive
  { value: 'user_id', partial: 'USER', expected: true },     // case-insensitive
  // False cases
  { value: 'user_id', partial: 'xyz', expected: false },
  { value: 'created_at', partial: 'zzz', expected: false },
  { value: 'user_id', partial: null, expected: false },
]

// ============================================================================
// TEST DATA - deduplicateCandidates
// ============================================================================

interface DedupeTestCase {
  name: string
  candidates: RankedSuggestion[]
  expected: string[]
}

const dedupeTests: DedupeTestCase[] = [
  {
    name: 'removes duplicates keeping highest scored',
    candidates: [
      { ...c('id', 'column'), score: 100, matchType: 'exact' },
      { ...c('id', 'column'), score: 50, matchType: 'prefix' },
      { ...c('name', 'column'), score: 80, matchType: 'exact' },
    ],
    expected: ['id', 'name'],
  },
  {
    name: 'case-insensitive deduplication',
    candidates: [
      { ...c('ID', 'column'), score: 50, matchType: 'prefix' },
      { ...c('id', 'column'), score: 100, matchType: 'exact' },
    ],
    expected: ['id'],
  },
]

// ============================================================================
// TESTS
// ============================================================================

describe('ranker', () => {
  describe('rankCandidates', () => {
    describe('SELECT_COLUMNS', () => runRankTests('SELECT_COLUMNS', selectColumnsTests))
    describe('FROM_TABLE', () => runRankTests('FROM_TABLE', fromTableTests))
    describe('WHERE_CONDITION', () => runRankTests('WHERE_CONDITION', whereConditionTests))
    describe('ORDER_BY', () => runRankTests('ORDER_BY', orderByTests))
    describe('GROUP_BY', () => runRankTests('GROUP_BY', groupByTests))
    describe('STATEMENT_START', () => runRankTests('STATEMENT_START', statementStartTests))
    describe('general', () => runRankTests('SELECT_COLUMNS', generalTests))

    describe('partial filtering', () => {
      for (const tc of partialFilterTests) {
        it(tc.name, () => {
          const context = createContext('SELECT_COLUMNS')
          const ranked = rankCandidates(tc.candidates, context, tc.partial, defaultSchema)
          expect(ranked.map((r) => r.value)).toEqual(tc.expected)
        })
      }
    })
  })

  describe('deduplicateCandidates', () => {
    for (const tc of dedupeTests) {
      it(tc.name, () => {
        expect(deduplicateCandidates(tc.candidates).map((d) => d.value)).toEqual(tc.expected)
      })
    }
  })

  describe('limitSuggestions', () => {
    const candidates100 = Array.from({ length: 100 }, (_, i) => ({
      ...c(`item${i}`, 'column'),
      score: 100 - i,
      matchType: 'exact' as const,
    }))

    it('limits to specified number', () => {
      expect(limitSuggestions(candidates100, 10)).toHaveLength(10)
    })

    it('defaults to 50 limit', () => {
      expect(limitSuggestions(candidates100)).toHaveLength(50)
    })
  })

  describe('groupSuggestionsByType', () => {
    it('groups by type correctly', () => {
      const candidates: RankedSuggestion[] = [
        { ...c('id', 'column'), score: 100, matchType: 'exact' },
        { ...c('name', 'column'), score: 90, matchType: 'exact' },
        { ...c('users', 'table'), score: 80, matchType: 'exact' },
      ]
      const grouped = groupSuggestionsByType(candidates)
      expect(grouped.get('column')).toHaveLength(2)
      expect(grouped.get('table')).toHaveLength(1)
    })
  })

  describe('computeMatchType', () => {
    for (const tc of matchTypeTests) {
      it(`${tc.value} + ${tc.partial} → ${tc.expected}`, () => {
        expect(computeMatchType(tc.value, tc.partial)).toBe(tc.expected)
      })
    }
  })

  describe('isMatch', () => {
    for (const tc of isMatchTests) {
      it(`${tc.value} + ${tc.partial} → ${tc.expected}`, () => {
        expect(isMatch(tc.value, tc.partial)).toBe(tc.expected)
      })
    }
  })
})

import type { ParsedSql, SelectStmt } from './core'
import { parseSql } from './core'

export interface StatementRange {
  from: number
  to: number
}

export interface FoldRegion {
  from: number
  to: number
  keyword: string
}

export interface EditorInfo {
  statementRanges: StatementRange[]
  foldRegions: FoldRegion[]
}

export async function getEditorInfo(sql: string): Promise<EditorInfo> {
  if (!sql.trim()) {
    return { statementRanges: [], foldRegions: [] }
  }

  try {
    const parsed = await parseSql(sql)
    const ranges = getStatementBoundaries(sql, parsed)
    return {
      statementRanges: ranges,
      foldRegions: extractFoldRegions(sql, parsed, ranges),
    }
  } catch {
    return { statementRanges: [], foldRegions: [] }
  }
}

function getStatementBoundaries(sql: string, parsed: ParsedSql): StatementRange[] {
  const rawStmts = parsed.raw.stmts
  return rawStmts.map((stmt, i) => {
    const rawFrom = stmt.stmt_location ?? 0
    const to = i < rawStmts.length - 1 ? (rawStmts[i + 1].stmt_location ?? sql.length) : sql.length

    // Skip leading whitespace to find the actual start of the statement
    let from = rawFrom
    while (from < to && /\s/.test(sql[from])) {
      from++
    }

    return { from, to }
  })
}

function extractFoldRegions(sql: string, parsed: ParsedSql, ranges: StatementRange[]): FoldRegion[] {
  const regions: FoldRegion[] = []

  for (let i = 0; i < parsed.statements.length; i++) {
    const stmt = parsed.statements[i]
    const { from: stmtStart, to: stmtEnd } = ranges[i]

    if (stmt.kind === 'select') {
      extractSelectFoldRegions(sql, stmt, stmtStart, stmtEnd, regions)
    }
  }

  // Filter to multi-line only and deduplicate
  const seen = new Set<number>()
  return regions.filter(r => {
    if (seen.has(r.from)) return false
    seen.add(r.from)
    const text = sql.slice(r.from, r.to)
    return text.includes('\n')
  })
}

function extractSelectFoldRegions(
  sql: string,
  stmt: SelectStmt,
  stmtStart: number,
  stmtEnd: number,
  regions: FoldRegion[]
): void {
  const clauses: { keyword: string; location: number }[] = []

  // Find SELECT keyword
  if (stmt.columns.length > 0) {
    const selectIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'SELECT')
    if (selectIdx !== -1) clauses.push({ keyword: 'SELECT', location: selectIdx })
  }

  // Find FROM keyword
  if (stmt.from) {
    const fromIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'FROM')
    if (fromIdx !== -1) clauses.push({ keyword: 'FROM', location: fromIdx })
  }

  // Find WHERE keyword
  if (stmt.where) {
    const whereIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'WHERE')
    if (whereIdx !== -1) clauses.push({ keyword: 'WHERE', location: whereIdx })
  }

  // Find GROUP BY keyword
  if (stmt.groupBy) {
    const groupIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'GROUP')
    if (groupIdx !== -1) clauses.push({ keyword: 'GROUP BY', location: groupIdx })
  }

  // Find HAVING keyword
  if (stmt.having) {
    const havingIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'HAVING')
    if (havingIdx !== -1) clauses.push({ keyword: 'HAVING', location: havingIdx })
  }

  // Find ORDER BY keyword
  if (stmt.orderBy) {
    const orderIdx = findKeywordAfter(sql, stmtStart, stmtEnd, 'ORDER')
    if (orderIdx !== -1) clauses.push({ keyword: 'ORDER BY', location: orderIdx })
  }

  // Sort by location
  clauses.sort((a, b) => a.location - b.location)

  // Create regions
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i]
    const nextClause = clauses[i + 1]
    const end = nextClause ? nextClause.location : findStatementEnd(sql, clause.location, stmtEnd)
    regions.push({ from: clause.location, to: end, keyword: clause.keyword })
  }

  // TODO: Recurse into CTEs for fold regions

  // Recurse into set operations
  if (stmt.setOp) {
    extractSelectFoldRegions(sql, stmt.setOp.left, stmtStart, stmtEnd, regions)
    extractSelectFoldRegions(sql, stmt.setOp.right, stmtStart, stmtEnd, regions)
  }
}

function findKeywordAfter(sql: string, start: number, end: number, keyword: string): number {
  const searchArea = sql.slice(start, end).toUpperCase()
  let idx = 0
  while (idx < searchArea.length) {
    const found = searchArea.indexOf(keyword, idx)
    if (found === -1) return -1

    const absoluteIdx = start + found
    const before = absoluteIdx > 0 ? sql[absoluteIdx - 1] : ' '
    const after = sql[absoluteIdx + keyword.length] || ' '

    if (/[\s(]/.test(before) && /[\s(]/.test(after)) {
      return absoluteIdx
    }
    idx = found + 1
  }
  return -1
}

function findStatementEnd(sql: string, from: number, maxEnd: number): number {
  const semiIdx = sql.indexOf(';', from)
  if (semiIdx !== -1 && semiIdx < maxEnd) return semiIdx
  return maxEnd
}

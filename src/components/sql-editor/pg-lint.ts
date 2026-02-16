import { linter, type Diagnostic, type Action } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import { ensureModuleLoaded } from '@/lib/sql'
import { parseSync } from '@libpg-query/parser'

/** Convert byte offset to character offset for UTF-8 text. */
function byteToCharOffset(text: string, byteOffset: number): number {
  const encoder = new TextEncoder()
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    bytes += encoder.encode(text[i]).length
    if (bytes >= byteOffset) return i
  }
  return text.length
}

/** Expand position to surrounding word. */
function expandToWord(text: string, pos: number): [number, number] {
  let from = pos, to = pos
  while (from > 0 && /\w/.test(text[from - 1])) from--
  while (to < text.length && /\w/.test(text[to])) to++
  return [from, Math.max(to, from + 1)]
}

/** Keywords that expect more input - position errors at these when at statement end. */
const TRAILING_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'ON', 'SET',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'VALUES', 'INTO',
]

function findTrailingKeyword(sql: string): number {
  const trimmed = sql.trimEnd()
  const upper = trimmed.toUpperCase()
  for (const kw of TRAILING_KEYWORDS) {
    if (upper.endsWith(kw)) {
      const pos = trimmed.length - kw.length
      if (pos === 0 || /\s/.test(trimmed[pos - 1])) return pos
    }
  }
  return -1
}

/** Split SQL into statements by semicolons, respecting strings/comments/dollar-quotes. */
function splitStatements(sql: string): Array<{ text: string; start: number }> {
  const results: Array<{ text: string; start: number }> = []
  let i = 0, stmtStart = 0

  while (i < sql.length) {
    const ch = sql[i]

    // String literal
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      while (i < sql.length && !(sql[i] === quote && sql[i + 1] !== quote)) {
        if (sql[i] === quote) i++ // skip escaped quote
        i++
      }
      i++ // closing quote
      continue
    }

    // Dollar quote: $tag$...$tag$
    if (ch === '$') {
      const match = sql.slice(i).match(/^\$[a-zA-Z_]?[a-zA-Z0-9_]*\$/)
      if (match) {
        const tag = match[0]
        const endIdx = sql.indexOf(tag, i + tag.length)
        i = endIdx !== -1 ? endIdx + tag.length : sql.length
        continue
      }
    }

    // Line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i)
      i = newline !== -1 ? newline + 1 : sql.length
      continue
    }

    // Block comment
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end !== -1 ? end + 2 : sql.length
      continue
    }

    // Statement separator
    if (ch === ';') {
      const text = sql.slice(stmtStart, i + 1).trim()
      if (text) results.push({ text, start: stmtStart })
      stmtStart = i + 1
    }

    i++
  }

  // Last statement (may not end with semicolon)
  const text = sql.slice(stmtStart).trim()
  if (text) results.push({ text, start: stmtStart })

  return results
}

interface ParseError { message: string; cursorPosition?: number }

export interface LintFixHandler {
  onFixWithAI: (errorMessage: string, from: number) => void
}

export function pgLinter(fixHandler?: LintFixHandler) {
  return linter(
    async (view: EditorView): Promise<Diagnostic[]> => {
      const doc = view.state.doc.toString()
      if (!doc.trim()) return []

      await ensureModuleLoaded()

      const diagnostics: Diagnostic[] = []

      for (const stmt of splitStatements(doc)) {
        try {
          parseSync(stmt.text)
        } catch (err) {
          const { message, cursorPosition } = err as ParseError
          const bytePos = cursorPosition ? cursorPosition - 1 : 0
          let charPos = byteToCharOffset(stmt.text, bytePos)

          // If error near start, check for trailing incomplete keyword
          if (charPos <= 10) {
            const trailingPos = findTrailingKeyword(stmt.text)
            if (trailingPos !== -1) charPos = trailingPos
          }

          // Find actual position in document
          const stmtPos = doc.indexOf(stmt.text, stmt.start)
          const docPos = (stmtPos !== -1 ? stmtPos : stmt.start) + charPos
          const [from, to] = expandToWord(doc, docPos)

          const errorMessage = message || 'Syntax error'
          const errorFrom = Math.max(0, from)
          const errorTo = Math.min(doc.length, to)

          const actions: Action[] = []

          if (fixHandler) {
            actions.push({
              name: 'Fix with AI',
              apply: () => {
                fixHandler.onFixWithAI(errorMessage, errorFrom)
              }
            })
          }

          diagnostics.push({
            from: errorFrom,
            to: errorTo,
            severity: 'error',
            message: errorMessage,
            actions: actions.length > 0 ? actions : undefined,
          })
        }
      }

      return diagnostics
    },
    { delay: 400 }
  )
}

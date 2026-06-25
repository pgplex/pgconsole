// Transport-agnostic helpers shared by every SQL execution path (the ConnectRPC ExecuteSQL
// handler and the MCP execution tools). Identity resolution, permission enforcement, and
// response shaping stay in each transport; what's identical — how a batch is made safe to run
// and how a Postgres error is rendered — lives here so the two paths can't drift.

// The shape of detectRequiredPermissions() this module needs.
interface StatementAnalysis {
  statementCount: number
  transactionSafe: boolean
}

// Build the SQL actually sent to the server. A safe multi-statement batch is wrapped in a
// transaction so a mid-batch failure rolls back; without it, PostgreSQL's Simple Query protocol
// runs each statement in autocommit, leaving 1..N-1 committed when statement N fails. Statements
// that cannot run inside a transaction (CREATE DATABASE, VACUUM, CREATE INDEX CONCURRENTLY) are
// excluded upstream via `transactionSafe`. The `\n;\n` before COMMIT terminates the user's last
// statement even when it lacks a trailing semicolon or ends in a line comment (a bare `;` would
// be swallowed by the comment).
export function buildExecutableSql(rawSql: string, analysis: StatementAnalysis): string {
  return analysis.statementCount > 1 && analysis.transactionSafe ? `BEGIN;\n${rawSql}\n;\nCOMMIT;` : rawSql
}

// Render a thrown postgres.js error into a readable message: the base message, plus line context
// derived from the error position, plus PostgreSQL's DETAIL and HINT when present. `sql` is the
// statement the position refers to.
export function formatExecutionError(err: unknown, sql: string): string {
  const baseMessage = err instanceof Error ? err.message : 'Query execution failed'
  let fullError = baseMessage

  const pgErr = err as Record<string, unknown>
  const pos = pgErr?.position
  if (typeof pos === 'string' && pos) {
    const charPos = parseInt(pos, 10)
    if (charPos > 0) {
      const before = sql.slice(0, charPos - 1)
      const lineNumber = before.split('\n').length
      const lines = sql.split('\n')
      const offendingLine = lines[lineNumber - 1]
      if (offendingLine !== undefined) {
        fullError = `ERROR at Line ${lineNumber}: ${baseMessage}\nLINE ${lineNumber}: ${offendingLine}`
      }
    }
  }
  if (typeof pgErr?.detail === 'string' && pgErr.detail) {
    fullError += `\nDETAIL: ${pgErr.detail}`
  }
  if (typeof pgErr?.hint === 'string' && pgErr.hint) {
    fullError += `\nHINT: ${pgErr.hint}`
  }
  return fullError
}

import type {
  Statement,
  SelectStmt,
  InsertStmt,
  UpdateStmt,
  DeleteStmt,
  CreateTableStmt,
  AlterTableStmt,
  AlterTableCmd,
  CreateFunctionStmt,
  FunctionParameter,
  ColumnDef,
  TableConstraint,
  Expr,
  FromClause,
  SortExpr,
  TargetExpr,
  CTE,
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
  RowExpr,
  TableRef,
  SubqueryRef,
  JoinExpr,
  WindowDef,
  LockingClause,
  OnConflictClause,
  WindowFrameClause,
  WindowFrameBound,
} from './core'
import { parseSql } from './core'

const INDENT = '  '

function indentLines(text: string): string {
  return text.split('\n').map(line => INDENT + line).join('\n')
}

export async function formatSql(sql: string): Promise<string> {
  if (!sql.trim()) return sql
  try {
    const parsed = await parseSql(sql)
    return formatStatements(parsed.statements)
  } catch {
    return sql
  }
}

export function formatSqlOneLine(sql: string): string {
  if (!sql.trim()) return sql
  // Normalize whitespace: collapse multiple spaces/newlines/tabs into single spaces
  return sql.replace(/\s+/g, ' ').trim()
}

function formatStatements(stmts: Statement[]): string {
  const formatted = stmts.map(formatStatement).filter(Boolean)
  return formatted.join(';\n\n') + (formatted.length > 0 ? ';' : '')
}

function formatStatement(stmt: Statement): string {
  switch (stmt.kind) {
    case 'select': return formatSelect(stmt)
    case 'insert': return formatInsert(stmt)
    case 'update': return formatUpdate(stmt)
    case 'delete': return formatDelete(stmt)
    case 'create_table': return formatCreateTable(stmt)
    case 'alter_table': return formatAlterTable(stmt)
    case 'create_function': return formatCreateFunction(stmt)
    case 'unknown': return stmt.source
    // DDL statements - preserve original source (formatting not yet implemented)
    case 'drop':
    case 'create_view':
    case 'create_index':
    case 'truncate':
    case 'create_schema':
    case 'create_sequence':
    case 'alter_sequence':
    case 'create_type':
    case 'create_extension':
    case 'create_trigger':
    case 'comment':
    case 'grant':
    case 'revoke':
    case 'refresh_matview':
    // Utility statements - preserve original source
    case 'explain':
    case 'copy':
    case 'set':
    case 'show':
    case 'transaction':
    case 'vacuum':
    // Admin statements - preserve original source
    case 'create_role':
    case 'alter_role':
    case 'drop_role':
    case 'create_db':
    case 'alter_db':
    case 'drop_db':
    case 'create_tablespace':
    case 'drop_tablespace':
    case 'alter_system':
    case 'reindex':
    case 'cluster':
    case 'load':
    case 'checkpoint':
    case 'create_subscription':
    case 'alter_subscription':
    case 'drop_subscription':
    case 'create_publication':
    case 'alter_publication':
    case 'reassign_owned':
    case 'drop_owned':
      return stmt.source
    default:
      return stmt.source
  }
}

function formatSelect(stmt: SelectStmt): string {
  if (stmt.setOp) {
    const { op, all, left, right } = stmt.setOp
    const opKeyword = op.toUpperCase() + (all ? ' ALL' : '')
    return `${formatSelect(left)}\n${opKeyword}\n${formatSelect(right)}`
  }

  const parts: string[] = []

  if (stmt.withClause) {
    parts.push(formatWithClause(stmt.withClause))
    parts.push('')
  }

  if (stmt.distinctOn && stmt.distinctOn.length > 0) {
    const exprs = stmt.distinctOn.map(formatExpr).join(', ')
    parts.push(`SELECT DISTINCT ON (${exprs})`)
  } else {
    parts.push(stmt.distinct ? 'SELECT DISTINCT' : 'SELECT')
  }
  if (stmt.columns.length > 0) {
    parts.push(formatTargetList(stmt.columns))
  }

  if (stmt.from) {
    parts.push('FROM')
    parts.push(INDENT + formatFrom(stmt.from))
  }

  if (stmt.where) {
    parts.push('WHERE')
    parts.push(INDENT + formatExpr(stmt.where))
  }

  if (stmt.groupBy) {
    parts.push('GROUP BY')
    parts.push(stmt.groupBy.map(e => INDENT + formatGroupByItem(e)).join(',\n'))
  }

  if (stmt.having) {
    parts.push('HAVING')
    parts.push(INDENT + formatExpr(stmt.having))
  }

  if (stmt.windowClause) {
    parts.push('WINDOW')
    parts.push(stmt.windowClause
      .filter(w => w.name) // Skip windows without names (should not happen in valid WINDOW clause)
      .map(w => {
        const windowParts: string[] = []
        if (w.partitionBy) {
          windowParts.push(`PARTITION BY ${w.partitionBy.map(formatExpr).join(', ')}`)
        }
        if (w.orderBy) {
          windowParts.push(`ORDER BY ${w.orderBy.map(formatSortExpr).join(', ')}`)
        }
        if (w.frameClause && !isDefaultWindowFrame(w.frameClause)) {
          windowParts.push(formatWindowFrame(w.frameClause))
        }
        return `${INDENT}${w.name} AS (${windowParts.join(' ')})`
      }).join(',\n'))
  }

  if (stmt.orderBy) {
    parts.push('ORDER BY')
    parts.push(stmt.orderBy.map(s => INDENT + formatSortExpr(s)).join(',\n'))
  }

  if (stmt.limit) {
    parts.push('LIMIT')
    parts.push(INDENT + formatExpr(stmt.limit))
  }

  if (stmt.offset) {
    parts.push('OFFSET')
    parts.push(INDENT + formatExpr(stmt.offset))
  }

  if (stmt.lockingClause) {
    for (const locking of stmt.lockingClause) {
      parts.push(formatLockingClause(locking))
    }
  }

  return parts.join('\n')
}

function formatTargetList(targets: TargetExpr[]): string {
  return targets.map(t => {
    const expr = formatExpr(t.expr)
    return INDENT + (t.alias ? `${expr} AS ${t.alias}` : expr)
  }).join(',\n')
}

function formatWithClause(ctes: CTE[]): string {
  const formatted = ctes.map(cte => {
    const query = indentLines(formatSelect(cte.query))
    return `${cte.name} AS (\n${query}\n)`
  })
  const recursive = ctes.some(c => c.recursive) ? 'RECURSIVE ' : ''
  return `WITH ${recursive}${formatted.join(',\n')}`
}

function formatFrom(from: FromClause): string {
  switch (from.kind) {
    case 'table': return formatTableRef(from)
    case 'subquery': return formatSubqueryRef(from)
    case 'join': return formatJoin(from)
  }
}

function formatGroupByItem(item: any): string {
  // Check if it's a GroupingSet
  if (item && typeof item === 'object' && 'kind' in item &&
      (item.kind === 'rollup' || item.kind === 'cube' || item.kind === 'sets' || item.kind === 'empty')) {
    const gs = item as import('./core').GroupingSet

    if (gs.kind === 'empty') {
      return '()'
    }

    if (gs.kind === 'rollup') {
      if (gs.content.length === 0) return 'ROLLUP ()'
      const content = gs.content.map(formatGroupByItem).join(', ')
      return `ROLLUP (${content})`
    }

    if (gs.kind === 'cube') {
      if (gs.content.length === 0) return 'CUBE ()'
      const content = gs.content.map(formatGroupByItem).join(', ')
      return `CUBE (${content})`
    }

    if (gs.kind === 'sets') {
      if (gs.content.length === 0) return 'GROUPING SETS ()'
      const content = gs.content.map(item => {
        // Each item in GROUPING SETS needs to be wrapped in parentheses
        // unless it's already a GroupingSet (empty, rollup, cube, or nested sets)
        const formatted = formatGroupByItem(item)
        if (formatted === '()' || formatted.startsWith('ROLLUP') ||
            formatted.startsWith('CUBE') || formatted.startsWith('GROUPING SETS')) {
          return formatted
        }
        return `(${formatted})`
      }).join(', ')
      return `GROUPING SETS (${content})`
    }
  }

  // Otherwise it's a regular expression
  return formatExpr(item)
}

function formatTableRef(t: TableRef): string {
  let result = t.schema ? `${t.schema}.${t.table}` : t.table

  if (t.tablesample && t.tablesample.args.length > 0) {
    const method = t.tablesample.method.toUpperCase()
    const args = t.tablesample.args.map(formatExpr).join(', ')
    result += ` TABLESAMPLE ${method} (${args})`
    if (t.tablesample.repeatable) {
      result += ` REPEATABLE (${formatExpr(t.tablesample.repeatable)})`
    }
  }

  if (t.alias) result += ` ${t.alias}`
  return result
}

function formatSubqueryRef(s: SubqueryRef): string {
  const lateral = s.lateral ? 'LATERAL ' : ''

  if (s.lateral) {
    // LATERAL subqueries get double indentation (one from base, one extra for LATERAL)
    const query = indentLines(indentLines(formatSelect(s.query)))
    return `${lateral}(\n${query}\n${INDENT}) ${s.alias}`
  }

  const query = indentLines(formatSelect(s.query))
  return `${lateral}(\n${query}\n) ${s.alias}`
}

function formatJoin(j: JoinExpr): string {
  const left = formatFrom(j.left)
  const right = formatFrom(j.right)

  // CROSS JOIN without explicit keyword - use comma syntax
  if (j.type === 'cross' && !j.on && !j.using) {
    return `${left},\n${INDENT}${right}`
  }

  const joinType = j.type.toUpperCase() + ' JOIN'
  let result = `${left}\n${joinType}\n${INDENT}${right}`

  if (j.on) {
    result += ` ON ${formatExpr(j.on)}`
  } else if (j.using) {
    result += ` USING (${j.using.join(', ')})`
  }

  return result
}

function formatSortExpr(s: SortExpr): string {
  let result = formatExpr(s.expr)
  if (s.direction === 'desc') result += ' DESC'
  else if (s.direction === 'asc') result += ' ASC'
  if (s.nulls === 'first') result += ' NULLS FIRST'
  else if (s.nulls === 'last') result += ' NULLS LAST'
  return result
}

function formatLockingClause(locking: LockingClause): string {
  const strengthMap: Record<string, string> = {
    'update': 'FOR UPDATE',
    'no_key_update': 'FOR NO KEY UPDATE',
    'share': 'FOR SHARE',
    'key_share': 'FOR KEY SHARE',
  }
  let result = strengthMap[locking.strength]

  if (locking.lockedRels && locking.lockedRels.length > 0) {
    result += ' OF ' + locking.lockedRels.join(', ')
  }

  if (locking.waitPolicy === 'skip_locked') {
    result += ' SKIP LOCKED'
  } else if (locking.waitPolicy === 'nowait') {
    result += ' NOWAIT'
  }

  return result
}

function formatExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'column': return formatColumnRef(expr)
    case 'literal': return formatLiteral(expr)
    case 'func': return formatFuncCall(expr)
    case 'binary': return formatBinaryOp(expr)
    case 'unary': return formatUnaryOp(expr)
    case 'sublink': return formatSubLink(expr)
    case 'case': return formatCase(expr)
    case 'typecast': return formatTypeCast(expr)
    case 'nulltest': return formatNullTest(expr)
    case 'array': return formatArrayExpr(expr)
    case 'coalesce': return formatCoalesce(expr)
    case 'param': return formatParamRef(expr)
    case 'row': return formatRowExpr(expr)
    case 'unknown': return ''
  }
}

function formatColumnRef(c: ColumnRef): string {
  // EXCLUDED is a special table name in ON CONFLICT - uppercase it
  const table = c.table?.toLowerCase() === 'excluded' ? 'EXCLUDED' : c.table
  return table ? `${table}.${c.column}` : c.column
}

function formatLiteral(l: Literal): string {
  switch (l.type) {
    case 'string': return `'${String(l.value).replace(/'/g, "''")}'`
    case 'number': return String(l.value)
    case 'boolean': return l.value ? 'TRUE' : 'FALSE'
    case 'null': return 'NULL'
  }
}

function formatFuncCall(f: FuncCall): string {
  let args: string
  if (f.star) {
    args = '*'
  } else if (f.distinct) {
    args = 'DISTINCT ' + f.args.map(formatExpr).join(', ')
  } else {
    args = f.args.map(formatExpr).join(', ')
  }

  let result = `${f.name}(${args})`

  if (f.filter) {
    result += ` FILTER (WHERE ${formatExpr(f.filter)})`
  }

  if (f.over) {
    result += ' ' + formatWindowDef(f.over)
  }

  return result
}

function formatWindowDef(w: WindowDef): string {
  // If it's a named window reference (name present, no explicit clauses or only default frame)
  if (w.name && !w.partitionBy && !w.orderBy &&
      (!w.frameClause || isDefaultWindowFrame(w.frameClause))) {
    return `OVER ${w.name}`
  }

  const parts: string[] = []
  if (w.partitionBy) {
    parts.push(`PARTITION BY ${w.partitionBy.map(formatExpr).join(', ')}`)
  }
  if (w.orderBy) {
    parts.push(`ORDER BY ${w.orderBy.map(formatSortExpr).join(', ')}`)
  }
  // Skip default frame (RANGE UNBOUNDED PRECEDING) - only output explicit frames
  if (w.frameClause && !isDefaultWindowFrame(w.frameClause)) {
    parts.push(formatWindowFrame(w.frameClause))
  }
  return `OVER (${parts.join(' ')})`
}

function isDefaultWindowFrame(frame: WindowFrameClause): boolean {
  // Default frame: RANGE UNBOUNDED PRECEDING (when ORDER BY present but no explicit frame)
  return frame.type === 'range' && frame.start.type === 'unbounded_preceding' && !frame.end
}

function formatWindowFrame(frame: WindowFrameClause): string {
  const frameType = frame.type.toUpperCase()
  const startBound = formatFrameBound(frame.start)

  if (frame.end) {
    const endBound = formatFrameBound(frame.end)
    return `${frameType} BETWEEN ${startBound} AND ${endBound}`
  }

  return `${frameType} ${startBound}`
}

function formatFrameBound(bound: WindowFrameBound): string {
  switch (bound.type) {
    case 'unbounded_preceding':
      return 'UNBOUNDED PRECEDING'
    case 'unbounded_following':
      return 'UNBOUNDED FOLLOWING'
    case 'current_row':
      return 'CURRENT ROW'
    case 'preceding':
      return bound.offset ? `${formatExpr(bound.offset)} PRECEDING` : 'PRECEDING'
    case 'following':
      return bound.offset ? `${formatExpr(bound.offset)} FOLLOWING` : 'FOLLOWING'
  }
}

function formatBinaryOp(b: BinaryOp): string {
  const left = formatExpr(b.left)
  const right = formatExpr(b.right)

  if (b.op === 'AND' || b.op === 'OR') {
    return `${left}\n${INDENT}${b.op} ${right}`
  }

  return `${left} ${b.op} ${right}`
}

function formatUnaryOp(u: UnaryOp): string {
  return `${u.op} ${formatExpr(u.arg)}`
}

function formatSubLink(s: SubLink): string {
  const query = indentLines(formatSelect(s.subquery))

  switch (s.type) {
    case 'exists': return `EXISTS (\n${query}\n)`
    case 'any': return `${s.testExpr ? formatExpr(s.testExpr) + ' = ' : ''}ANY (\n${query}\n)`
    case 'all': return `${s.testExpr ? formatExpr(s.testExpr) + ' = ' : ''}ALL (\n${query}\n)`
    case 'scalar': return `(\n${query}\n)`
  }
}

function formatCase(c: CaseExpr): string {
  const parts: string[] = [c.arg ? `CASE ${formatExpr(c.arg)}` : 'CASE']
  for (const w of c.whens) {
    parts.push(`  WHEN ${formatExpr(w.when)} THEN ${formatExpr(w.then)}`)
  }
  if (c.else) {
    parts.push(`  ELSE ${formatExpr(c.else)}`)
  }
  parts.push('END')
  return parts.join('\n')
}

function formatTypeCast(t: TypeCast): string {
  // Special case: INTERVAL type uses prefix syntax
  if (t.type.toUpperCase() === 'INTERVAL' || t.type.toUpperCase() === 'PG_CATALOG.INTERVAL') {
    return `INTERVAL ${formatExpr(t.arg)}`
  }
  return `${formatExpr(t.arg)}::${t.type}`
}

function formatNullTest(n: NullTest): string {
  return `${formatExpr(n.arg)} IS ${n.isNull ? 'NULL' : 'NOT NULL'}`
}

function formatArrayExpr(a: ArrayExpr): string {
  return `ARRAY[${a.elements.map(formatExpr).join(', ')}]`
}

function formatCoalesce(c: CoalesceExpr): string {
  return `COALESCE(${c.args.map(formatExpr).join(', ')})`
}

function formatRowExpr(r: RowExpr): string {
  return `(${r.args.map(formatExpr).join(', ')})`
}

function formatParamRef(p: ParamRef): string {
  return `$${p.number}`
}

// ============ INSERT Formatter ============
function formatInsert(stmt: InsertStmt): string {
  const parts: string[] = []

  // INSERT INTO table (columns)
  let insertLine = 'INSERT INTO ' + formatTableRef(stmt.table)
  if (stmt.columns) {
    insertLine += ' (\n' + stmt.columns.map(c => INDENT + c).join(',\n') + '\n)'
  }
  parts.push(insertLine)

  // VALUES or SELECT
  if (stmt.values) {
    const valueRows = stmt.values.map(row =>
      '(\n' + row.map(v => INDENT + formatExpr(v)).join(',\n') + '\n)'
    )
    parts.push('VALUES ' + valueRows.join(', '))
  } else if (stmt.select) {
    parts.push(formatSelect(stmt.select))
  }

  // ON CONFLICT
  if (stmt.onConflict) {
    parts.push(formatOnConflict(stmt.onConflict))
  }

  // RETURNING
  if (stmt.returning) {
    parts.push('RETURNING')
    parts.push(formatTargetList(stmt.returning))
  }

  return parts.join('\n')
}

function formatOnConflict(clause: OnConflictClause): string {
  const parts: string[] = []

  if (clause.target && clause.target.length > 0) {
    parts.push(`ON CONFLICT (${clause.target.join(', ')})`)
  } else {
    parts.push('ON CONFLICT')
  }

  if (clause.action === 'nothing') {
    parts[0] += ' DO NOTHING'
  } else {
    // DO UPDATE
    parts[0] += ' DO UPDATE SET'
    if (clause.assignments && clause.assignments.length > 0) {
      const assignments = clause.assignments.map(a =>
        INDENT + `${a.column} = ${formatExpr(a.value)}`
      )
      parts.push(assignments.join(',\n'))
    }

    if (clause.where) {
      parts.push('WHERE')
      parts.push(INDENT + formatExpr(clause.where))
    }
  }

  return parts.join('\n')
}

// ============ UPDATE Formatter ============
function formatUpdate(stmt: UpdateStmt): string {
  const parts: string[] = []

  // UPDATE table
  parts.push('UPDATE ' + formatTableRef(stmt.table))

  // SET clause
  parts.push('SET')
  const assignments = stmt.assignments.map(a =>
    INDENT + `${a.column} = ${formatExpr(a.value)}`
  )
  parts.push(assignments.join(',\n'))

  // FROM clause
  if (stmt.from) {
    parts.push('FROM')
    parts.push(INDENT + formatFrom(stmt.from))
  }

  // WHERE clause
  if (stmt.where) {
    parts.push('WHERE')
    parts.push(INDENT + formatExpr(stmt.where))
  }

  // RETURNING
  if (stmt.returning) {
    parts.push('RETURNING')
    parts.push(formatTargetList(stmt.returning))
  }

  return parts.join('\n')
}

// ============ DELETE Formatter ============
function formatDelete(stmt: DeleteStmt): string {
  const parts: string[] = []

  // DELETE FROM table
  parts.push('DELETE FROM ' + formatTableRef(stmt.table))

  // USING clause
  if (stmt.using) {
    parts.push('USING')
    parts.push(INDENT + formatFrom(stmt.using))
  }

  // WHERE clause
  if (stmt.where) {
    parts.push('WHERE')
    parts.push(INDENT + formatExpr(stmt.where))
  }

  // RETURNING
  if (stmt.returning) {
    parts.push('RETURNING')
    parts.push(formatTargetList(stmt.returning))
  }

  return parts.join('\n')
}

// ============ CREATE TABLE Formatter ============
function formatCreateTable(stmt: CreateTableStmt): string {
  const parts: string[] = []

  // CREATE TABLE [IF NOT EXISTS] table
  let createLine = 'CREATE TABLE'
  if (stmt.ifNotExists) {
    createLine += ' IF NOT EXISTS'
  }
  createLine += ' ' + formatTableRef(stmt.table)

  // Column definitions and table constraints
  const elements: string[] = []

  // Format columns
  for (const col of stmt.columns) {
    elements.push(formatColumnDef(col))
  }

  // Format table-level constraints
  for (const constraint of stmt.constraints) {
    elements.push(formatTableConstraint(constraint))
  }

  if (elements.length > 0) {
    createLine += ' ('
    parts.push(createLine)
    parts.push(elements.map(e => INDENT + e).join(',\n'))
    parts.push(')')
  } else {
    parts.push(createLine)
  }

  return parts.join('\n')
}

function formatColumnDef(col: ColumnDef): string {
  let result = col.name + ' ' + col.type

  // Add NOT NULL if not nullable
  if (!col.nullable) {
    result += ' NOT NULL'
  }

  // Add DEFAULT if present
  if (col.default) {
    result += ' DEFAULT ' + formatExpr(col.default)
  }

  // Add inline constraints (PRIMARY KEY, UNIQUE)
  for (const constraint of col.constraints) {
    if (constraint.type === 'primary_key') {
      result += ' PRIMARY KEY'
    } else if (constraint.type === 'unique') {
      result += ' UNIQUE'
    }
  }

  return result
}

function formatTableConstraint(constraint: TableConstraint): string {
  let result = ''

  if (constraint.name) {
    result += 'CONSTRAINT ' + constraint.name + ' '
  }

  switch (constraint.type) {
    case 'primary_key':
      result += 'PRIMARY KEY (' + constraint.columns.join(', ') + ')'
      break
    case 'unique':
      result += 'UNIQUE (' + constraint.columns.join(', ') + ')'
      break
    case 'foreign_key':
      result += 'FOREIGN KEY (' + constraint.columns.join(', ') + ')'
      break
    case 'check':
      result += 'CHECK (...)'
      break
  }

  return result
}

// ============ ALTER TABLE Formatter ============
function formatAlterTable(stmt: AlterTableStmt): string {
  const parts: string[] = []

  // ALTER TABLE table
  parts.push('ALTER TABLE ' + formatTableRef(stmt.table))

  // Format each command
  for (const cmd of stmt.commands) {
    parts.push(INDENT + formatAlterTableCmd(cmd))
  }

  return parts.join('\n')
}

function formatAlterTableCmd(cmd: AlterTableCmd): string {
  switch (cmd.type) {
    case 'add_column':
      return 'ADD COLUMN ' + formatColumnDef(cmd.column)

    case 'drop_column':
      return 'DROP COLUMN ' + (cmd.ifExists ? 'IF EXISTS ' : '') + cmd.column

    case 'alter_column_type':
      return 'ALTER COLUMN ' + cmd.column + ' TYPE ' + cmd.dataType

    case 'set_not_null':
      return 'ALTER COLUMN ' + cmd.column + ' SET NOT NULL'

    case 'drop_not_null':
      return 'ALTER COLUMN ' + cmd.column + ' DROP NOT NULL'

    case 'set_default':
      return 'ALTER COLUMN ' + cmd.column + ' SET DEFAULT ' + formatExpr(cmd.default)

    case 'drop_default':
      return 'ALTER COLUMN ' + cmd.column + ' DROP DEFAULT'

    case 'add_constraint':
      return 'ADD ' + formatTableConstraint(cmd.constraint)

    case 'drop_constraint':
      return 'DROP CONSTRAINT ' + (cmd.ifExists ? 'IF EXISTS ' : '') + cmd.name
  }
}

// ============ CREATE FUNCTION/PROCEDURE Formatter ============
function formatCreateFunction(stmt: CreateFunctionStmt): string {
  const parts: string[] = []

  // CREATE [OR REPLACE] FUNCTION/PROCEDURE name
  let createLine = 'CREATE'
  if (stmt.replace) {
    createLine += ' OR REPLACE'
  }
  createLine += stmt.isProcedure ? ' PROCEDURE ' : ' FUNCTION '
  createLine += stmt.schema ? `${stmt.schema}.${stmt.name}` : stmt.name

  // Parameters
  if (stmt.parameters.length > 0) {
    createLine += '('
    parts.push(createLine)
    const paramLines = stmt.parameters.map(p => INDENT + formatFunctionParameter(p))
    parts.push(paramLines.join(',\n'))
    parts.push(')')
  } else {
    createLine += '()'
    parts.push(createLine)
  }

  // RETURNS clause (not for procedures)
  if (!stmt.isProcedure) {
    if (stmt.returnsTable && stmt.returnsTable.length > 0) {
      // RETURNS TABLE (col1 type1, col2 type2, ...)
      parts.push('RETURNS TABLE (')
      const colLines = stmt.returnsTable.map(p => INDENT + `${p.name || ''} ${p.type}`.trim())
      parts.push(colLines.join(',\n'))
      parts.push(')')
    } else if (stmt.returnType) {
      let returnsLine = 'RETURNS '
      if (stmt.returnsSetOf && !stmt.returnType.toUpperCase().startsWith('SETOF ')) {
        returnsLine += 'SETOF '
      }
      returnsLine += stmt.returnType
      parts.push(returnsLine)
    }
  }

  // LANGUAGE
  if (stmt.language) {
    parts.push('LANGUAGE ' + stmt.language)
  }

  // Options (each on its own line)
  if (stmt.volatility) {
    parts.push(stmt.volatility.toUpperCase())
  }

  if (stmt.strict === true) {
    parts.push('STRICT')
  } else if (stmt.strict === false) {
    parts.push('CALLED ON NULL INPUT')
  }

  if (stmt.securityDefiner === true) {
    parts.push('SECURITY DEFINER')
  } else if (stmt.securityDefiner === false) {
    parts.push('SECURITY INVOKER')
  }

  if (stmt.leakproof === true) {
    parts.push('LEAKPROOF')
  } else if (stmt.leakproof === false) {
    parts.push('NOT LEAKPROOF')
  }

  if (stmt.parallel) {
    parts.push('PARALLEL ' + stmt.parallel.toUpperCase())
  }

  if (stmt.cost !== null) {
    parts.push('COST ' + stmt.cost)
  }

  if (stmt.rows !== null) {
    parts.push('ROWS ' + stmt.rows)
  }

  // AS clause (function body)
  if (stmt.body && stmt.body.length > 0) {
    if (stmt.body.length === 1) {
      // Single body string - format with dollar quoting
      const bodyText = stmt.body[0]
      const delimiter = chooseDollarDelimiter(bodyText)
      parts.push(`AS ${delimiter}`)
      parts.push(bodyText)
      parts.push(delimiter)
    } else {
      // Two strings (object file, link symbol) - for C functions
      parts.push(`AS '${escapeSqlString(stmt.body[0])}', '${escapeSqlString(stmt.body[1])}'`)
    }
  }

  return parts.join('\n')
}

function formatFunctionParameter(param: FunctionParameter): string {
  const parts: string[] = []

  // Mode (IN, OUT, INOUT, VARIADIC) - skip 'in' as it's the default
  if (param.mode && param.mode !== 'in') {
    parts.push(param.mode.toUpperCase())
  }

  // Name (optional)
  if (param.name) {
    parts.push(param.name)
  }

  // Type (required)
  parts.push(param.type)

  // Default value
  if (param.default) {
    parts.push('DEFAULT ' + param.default)
  }

  return parts.join(' ')
}

function chooseDollarDelimiter(body: string): string {
  // Try common delimiters, find one not in the body
  const candidates = ['$$', '$body$', '$func$', '$function$', '$_$']
  for (const delim of candidates) {
    if (!body.includes(delim)) {
      return delim
    }
  }
  // Fallback: generate a unique one
  let i = 1
  while (body.includes(`$d${i}$`)) i++
  return `$d${i}$`
}

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''")
}

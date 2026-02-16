import { parseSync, loadModule } from '@libpg-query/parser'

// ============ Module Loading ============
let moduleLoaded = false
let moduleLoadingPromise: Promise<void> | null = null

export async function ensureModuleLoaded(): Promise<void> {
  if (moduleLoaded) return
  if (moduleLoadingPromise) return moduleLoadingPromise
  moduleLoadingPromise = loadModule().then(() => {
    moduleLoaded = true
  })
  return moduleLoadingPromise
}

export function isModuleLoaded(): boolean {
  return moduleLoaded
}

// ============ Raw AST Types ============
interface RawParseResult {
  version: number
  stmts: RawStatement[]
}

interface RawStatement {
  stmt: unknown
  stmt_location?: number
  stmt_len?: number
}

// ============ IR Types - Top Level ============
export interface ParsedSql {
  statements: Statement[]
  raw: RawParseResult
}

export type Statement =
  | SelectStmt
  | InsertStmt
  | UpdateStmt
  | DeleteStmt
  | CreateTableStmt
  | AlterTableStmt
  | DropStmt
  | CreateViewStmt
  | CreateIndexStmt
  | CreateFunctionStmt
  | TruncateStmt
  | ExplainStmt
  | CopyStmt
  | GrantStmt
  | RevokeStmt
  | CreateSchemaStmt
  | CreateSequenceStmt
  | AlterSequenceStmt
  | CreateTypeStmt
  | CreateExtensionStmt
  | CreateTriggerStmt
  | CommentStmt
  | TransactionStmt
  | SetStmt
  | ShowStmt
  | VacuumStmt
  | RefreshMatViewStmt
  // Admin-level statements
  | CreateRoleStmt
  | AlterRoleStmt
  | DropRoleStmt
  | CreateDbStmt
  | AlterDbStmt
  | DropDbStmt
  | CreateTablespaceStmt
  | DropTablespaceStmt
  | AlterSystemStmt
  | ReindexStmt
  | ClusterStmt
  | LoadStmt
  | CheckpointStmt
  | CreateSubscriptionStmt
  | AlterSubscriptionStmt
  | DropSubscriptionStmt
  | CreatePublicationStmt
  | AlterPublicationStmt
  | ReassignOwnedStmt
  | DropOwnedStmt
  | CallStmt
  | UnknownStmt

export interface SelectStmt {
  kind: 'select'
  distinct: boolean
  distinctOn: Expr[] | null  // DISTINCT ON (expressions)
  columns: TargetExpr[]
  from: FromClause | null
  where: Expr | null
  groupBy: (Expr | GroupingSet)[] | null
  having: Expr | null
  orderBy: SortExpr[] | null
  limit: Expr | null
  offset: Expr | null
  windowClause: WindowDef[] | null  // Named windows (WINDOW clause)
  withClause: CTE[] | null
  setOp: SetOperation | null
  lockingClause: LockingClause[] | null
}

export interface InsertStmt {
  kind: 'insert'
  table: TableRef
  columns: string[] | null
  values: Expr[][] | null      // VALUES (...), (...) - null if INSERT ... SELECT
  select: SelectStmt | null    // INSERT ... SELECT - null if VALUES
  onConflict: OnConflictClause | null
  returning: TargetExpr[] | null
}

export interface UpdateStmt {
  kind: 'update'
  table: TableRef
  assignments: { column: string; value: Expr }[]
  from: FromClause | null
  where: Expr | null
  returning: TargetExpr[] | null
}

export interface DeleteStmt {
  kind: 'delete'
  table: TableRef
  using: FromClause | null
  where: Expr | null
  returning: TargetExpr[] | null
}

export interface CreateTableStmt {
  kind: 'create_table'
  table: TableRef
  columns: ColumnDef[]
  constraints: TableConstraint[]
  ifNotExists: boolean
}

export interface ColumnDef {
  name: string
  type: string
  nullable: boolean       // true if nullable (no NOT NULL), false if NOT NULL
  default: Expr | null
  constraints: ColumnConstraint[]
}

export interface ColumnConstraint {
  type: 'primary_key' | 'unique' | 'not_null' | 'check' | 'references'
  name: string | null
}

export interface TableConstraint {
  type: 'primary_key' | 'unique' | 'check' | 'foreign_key'
  name: string | null
  columns: string[]
}

export interface AlterTableStmt {
  kind: 'alter_table'
  table: TableRef
  commands: AlterTableCmd[]
}

export type AlterTableCmd =
  | { type: 'add_column'; column: ColumnDef }
  | { type: 'drop_column'; column: string; ifExists: boolean }
  | { type: 'alter_column_type'; column: string; dataType: string }
  | { type: 'set_not_null'; column: string }
  | { type: 'drop_not_null'; column: string }
  | { type: 'set_default'; column: string; default: Expr }
  | { type: 'drop_default'; column: string }
  | { type: 'add_constraint'; constraint: TableConstraint }
  | { type: 'drop_constraint'; name: string; ifExists: boolean }

export interface DropStmt {
  kind: 'drop'
  objectType: 'table' | 'view' | 'materialized_view' | 'index' | 'function' | 'procedure' | 'schema' | 'trigger' | 'other'
  objects: Array<{ schema: string | null; name: string; args?: string }>
  ifExists: boolean
  cascade: boolean
  source: string
}

export interface CreateViewStmt {
  kind: 'create_view'
  view: TableRef
  query: SelectStmt
  replace: boolean
  materialized: boolean
  ifNotExists: boolean
  source: string
}

export interface CreateIndexStmt {
  kind: 'create_index'
  name: string | null
  table: TableRef
  columns: Array<{ name: string; order: 'asc' | 'desc' | null }>
  unique: boolean
  concurrent: boolean
  ifNotExists: boolean
  source: string
}

export interface FunctionParameter {
  name: string | null
  type: string
  mode: 'in' | 'out' | 'inout' | 'variadic' | 'table' | null
  default: string | null
}

export interface CreateFunctionStmt {
  kind: 'create_function'
  name: string
  schema: string | null
  parameters: FunctionParameter[]
  returnType: string | null
  returnsSetOf: boolean
  returnsTable: FunctionParameter[] | null
  replace: boolean
  language: string | null
  isProcedure: boolean
  // Options
  volatility: 'immutable' | 'stable' | 'volatile' | null
  strict: boolean | null
  securityDefiner: boolean | null
  leakproof: boolean | null
  cost: number | null
  rows: number | null
  parallel: 'safe' | 'restricted' | 'unsafe' | null
  // Body
  body: string[] | null  // AS clause strings
  source: string
}

export interface TruncateStmt {
  kind: 'truncate'
  tables: TableRef[]
  cascade: boolean
  restartIdentity: boolean
  source: string
}

export interface ExplainStmt { kind: 'explain'; source: string }
export interface CopyStmt { kind: 'copy'; isFrom: boolean; source: string }
export interface GrantStmt { kind: 'grant'; source: string }
export interface RevokeStmt { kind: 'revoke'; source: string }
export interface CreateSchemaStmt { kind: 'create_schema'; source: string }
export interface CreateSequenceStmt { kind: 'create_sequence'; source: string }
export interface AlterSequenceStmt { kind: 'alter_sequence'; source: string }
export interface CreateTypeStmt { kind: 'create_type'; source: string }
export interface CreateExtensionStmt { kind: 'create_extension'; source: string }
export interface CreateTriggerStmt { kind: 'create_trigger'; source: string }
export interface CommentStmt { kind: 'comment'; source: string }
export interface TransactionStmt { kind: 'transaction'; source: string }
export interface SetStmt { kind: 'set'; source: string }
export interface ShowStmt { kind: 'show'; source: string }
export interface VacuumStmt { kind: 'vacuum'; source: string }
export interface RefreshMatViewStmt { kind: 'refresh_matview'; source: string }
// Admin-level statements
export interface CreateRoleStmt { kind: 'create_role'; source: string }
export interface AlterRoleStmt { kind: 'alter_role'; source: string }
export interface DropRoleStmt { kind: 'drop_role'; source: string }
export interface CreateDbStmt { kind: 'create_db'; source: string }
export interface AlterDbStmt { kind: 'alter_db'; source: string }
export interface DropDbStmt { kind: 'drop_db'; source: string }
export interface CreateTablespaceStmt { kind: 'create_tablespace'; source: string }
export interface DropTablespaceStmt { kind: 'drop_tablespace'; source: string }
export interface AlterSystemStmt { kind: 'alter_system'; source: string }
export interface ReindexStmt { kind: 'reindex'; source: string }
export interface ClusterStmt { kind: 'cluster'; source: string }
export interface LoadStmt { kind: 'load'; source: string }
export interface CheckpointStmt { kind: 'checkpoint'; source: string }
export interface CreateSubscriptionStmt { kind: 'create_subscription'; source: string }
export interface AlterSubscriptionStmt { kind: 'alter_subscription'; source: string }
export interface DropSubscriptionStmt { kind: 'drop_subscription'; source: string }
export interface CreatePublicationStmt { kind: 'create_publication'; source: string }
export interface AlterPublicationStmt { kind: 'alter_publication'; source: string }
export interface ReassignOwnedStmt { kind: 'reassign_owned'; source: string }
export interface DropOwnedStmt { kind: 'drop_owned'; source: string }
export interface CallStmt { kind: 'call'; source: string }
export interface UnknownStmt { kind: 'unknown'; raw: unknown; source: string }

// ============ IR Types - Expressions ============
export type Expr =
  | ColumnRef
  | Literal
  | FuncCall
  | BinaryOp
  | UnaryOp
  | SubLink
  | CaseExpr
  | TypeCast
  | NullTest
  | ArrayExpr
  | CoalesceExpr
  | ParamRef
  | RowExpr
  | UnknownExpr

export interface ColumnRef {
  kind: 'column'
  table: string | null
  column: string
}

export interface Literal {
  kind: 'literal'
  type: 'string' | 'number' | 'boolean' | 'null'
  value: string | number | boolean | null
}

export interface FuncCall {
  kind: 'func'
  name: string
  args: Expr[]
  distinct: boolean
  star: boolean
  filter: Expr | null
  over: WindowDef | null
}

export interface BinaryOp {
  kind: 'binary'
  op: string
  left: Expr
  right: Expr
}

export interface UnaryOp {
  kind: 'unary'
  op: string
  arg: Expr
}

export interface SubLink {
  kind: 'sublink'
  type: 'exists' | 'any' | 'all' | 'scalar'
  subquery: SelectStmt
  testExpr: Expr | null
}

export interface CaseExpr {
  kind: 'case'
  arg: Expr | null
  whens: { when: Expr; then: Expr }[]
  else: Expr | null
}

export interface TypeCast {
  kind: 'typecast'
  arg: Expr
  type: string
}

export interface NullTest {
  kind: 'nulltest'
  arg: Expr
  isNull: boolean
}

export interface ArrayExpr {
  kind: 'array'
  elements: Expr[]
}

export interface CoalesceExpr {
  kind: 'coalesce'
  args: Expr[]
}

export interface ParamRef {
  kind: 'param'
  number: number
}

export interface RowExpr {
  kind: 'row'
  args: Expr[]
}

export interface UnknownExpr {
  kind: 'unknown'
  raw: unknown
}

// ============ IR Types - Clauses ============
export type FromClause = TableRef | SubqueryRef | JoinExpr

export interface TableSample {
  method: string
  args: Expr[]
  repeatable: Expr | null
}

export interface TableRef {
  kind: 'table'
  schema: string | null
  table: string
  alias: string | null
  tablesample: TableSample | null
}

export interface SubqueryRef {
  kind: 'subquery'
  lateral: boolean
  query: SelectStmt
  alias: string
}

export interface JoinExpr {
  kind: 'join'
  type: 'inner' | 'left' | 'right' | 'full' | 'cross'
  left: FromClause
  right: FromClause
  on: Expr | null
  using: string[] | null
}

export interface SortExpr {
  expr: Expr
  direction: 'asc' | 'desc' | null
  nulls: 'first' | 'last' | null
}

export interface WindowDef {
  name: string | null  // For named windows (WINDOW clause)
  partitionBy: Expr[] | null
  orderBy: SortExpr[] | null
  frameClause: WindowFrameClause | null
}

export interface WindowFrameClause {
  type: 'rows' | 'range' | 'groups'
  start: WindowFrameBound
  end: WindowFrameBound | null  // null for single-bound frames
}

export interface WindowFrameBound {
  type: 'unbounded_preceding' | 'unbounded_following' | 'current_row' | 'preceding' | 'following'
  offset: Expr | null  // for 'preceding' and 'following' with offset
}

export interface LockingClause {
  strength: 'update' | 'no_key_update' | 'share' | 'key_share'
  waitPolicy: 'block' | 'skip_locked' | 'nowait'
  lockedRels: string[] | null  // null means lock all tables in FROM
}

export interface OnConflictClause {
  action: 'update' | 'nothing'
  target: string[] | null  // Conflict columns, null means no target specified
  assignments: { column: string; value: Expr }[] | null  // SET clause for DO UPDATE
  where: Expr | null  // WHERE clause for DO UPDATE
}

export interface GroupingSet {
  kind: 'rollup' | 'cube' | 'sets' | 'empty'
  content: (Expr | GroupingSet)[]  // Nested grouping sets allowed
}

export interface CTE {
  name: string
  query: SelectStmt
  recursive: boolean
}

export interface SetOperation {
  op: 'union' | 'intersect' | 'except'
  all: boolean
  left: SelectStmt
  right: SelectStmt
}

export interface TargetExpr {
  expr: Expr
  alias: string | null
}

// ============ Public API ============
export async function parseSql(sql: string): Promise<ParsedSql> {
  if (!sql.trim()) {
    return { statements: [], raw: { version: 0, stmts: [] } }
  }
  await ensureModuleLoaded()
  const raw = parseSync(sql) as RawParseResult
  return transformToIR(raw, sql)
}

// ============ Transformer - Main ============
function transformToIR(raw: RawParseResult, sql: string): ParsedSql {
  return {
    statements: raw.stmts.map((s, i) => {
      // Extract source text using stmt_location and stmt_len
      const start = s.stmt_location ?? 0
      const end = s.stmt_len !== undefined
        ? start + s.stmt_len
        : (i < raw.stmts.length - 1 ? raw.stmts[i + 1].stmt_location ?? sql.length : sql.length)
      const source = sql.slice(start, end).replace(/;\s*$/, '').trim()
      return transformStatement(s.stmt, source)
    }),
    raw,
  }
}

function transformStatement(node: unknown, source: string): Statement {
  if (!node || typeof node !== 'object') return { kind: 'unknown', raw: node, source }
  const obj = node as Record<string, unknown>

  if ('SelectStmt' in obj) return transformSelect(obj.SelectStmt as Record<string, unknown>)
  if ('InsertStmt' in obj) return transformInsert(obj.InsertStmt as Record<string, unknown>)
  if ('UpdateStmt' in obj) return transformUpdate(obj.UpdateStmt as Record<string, unknown>)
  if ('DeleteStmt' in obj) return transformDelete(obj.DeleteStmt as Record<string, unknown>)
  if ('CreateStmt' in obj) return transformCreateTable(obj.CreateStmt as Record<string, unknown>)
  if ('AlterTableStmt' in obj) return transformAlterTable(obj.AlterTableStmt as Record<string, unknown>)
  if ('DropStmt' in obj) return transformDrop(obj.DropStmt as Record<string, unknown>, source)
  if ('ViewStmt' in obj) return transformCreateView(obj.ViewStmt as Record<string, unknown>, source)
  if ('CreateTableAsStmt' in obj) return transformCreateTableAs(obj.CreateTableAsStmt as Record<string, unknown>, source)
  if ('IndexStmt' in obj) return transformCreateIndex(obj.IndexStmt as Record<string, unknown>, source)
  if ('CreateFunctionStmt' in obj) return transformCreateFunction(obj.CreateFunctionStmt as Record<string, unknown>, source)
  if ('TruncateStmt' in obj) return transformTruncate(obj.TruncateStmt as Record<string, unknown>, source)

  // Additional DDL statements
  if ('CreateSchemaStmt' in obj) return { kind: 'create_schema', source }
  if ('CreateSeqStmt' in obj) return { kind: 'create_sequence', source }
  if ('AlterSeqStmt' in obj) return { kind: 'alter_sequence', source }
  if ('CompositeTypeStmt' in obj) return { kind: 'create_type', source }
  if ('CreateEnumStmt' in obj) return { kind: 'create_type', source }
  if ('CreateRangeStmt' in obj) return { kind: 'create_type', source }
  if ('CreateExtensionStmt' in obj) return { kind: 'create_extension', source }
  if ('CreateTrigStmt' in obj) return { kind: 'create_trigger', source }
  if ('CommentStmt' in obj) return { kind: 'comment', source }
  if ('GrantStmt' in obj) return { kind: 'grant', source }
  if ('GrantRoleStmt' in obj) return { kind: 'grant', source }
  if ('RevokeStmt' in obj) return { kind: 'revoke', source }
  if ('RefreshMatViewStmt' in obj) return { kind: 'refresh_matview', source }

  // Read-only / utility statements
  if ('ExplainStmt' in obj) return { kind: 'explain', source }
  if ('VariableSetStmt' in obj) return { kind: 'set', source }
  if ('VariableShowStmt' in obj) return { kind: 'show', source }

  // Transaction control
  if ('TransactionStmt' in obj) return { kind: 'transaction', source }

  // Maintenance
  if ('VacuumStmt' in obj) return { kind: 'vacuum', source }

  // COPY statement
  if ('CopyStmt' in obj) {
    const copy = obj.CopyStmt as Record<string, unknown>
    return { kind: 'copy', isFrom: !!copy.is_from, source }
  }

  // Admin-level statements (role/user/database/server management)
  if ('CreateRoleStmt' in obj) return { kind: 'create_role', source }
  if ('CreateUserStmt' in obj) return { kind: 'create_role', source }
  if ('CreateGroupStmt' in obj) return { kind: 'create_role', source }
  if ('AlterRoleStmt' in obj) return { kind: 'alter_role', source }
  if ('AlterRoleSetStmt' in obj) return { kind: 'alter_role', source }
  if ('AlterGroupStmt' in obj) return { kind: 'alter_role', source }
  if ('DropRoleStmt' in obj) return { kind: 'drop_role', source }
  if ('CreatedbStmt' in obj) return { kind: 'create_db', source }
  if ('AlterDatabaseStmt' in obj) return { kind: 'alter_db', source }
  if ('AlterDatabaseSetStmt' in obj) return { kind: 'alter_db', source }
  if ('DropdbStmt' in obj) return { kind: 'drop_db', source }
  if ('CreateTableSpaceStmt' in obj) return { kind: 'create_tablespace', source }
  if ('DropTableSpaceStmt' in obj) return { kind: 'drop_tablespace', source }
  if ('AlterSystemStmt' in obj) return { kind: 'alter_system', source }
  if ('ReindexStmt' in obj) return { kind: 'reindex', source }
  if ('ClusterStmt' in obj) return { kind: 'cluster', source }
  if ('LoadStmt' in obj) return { kind: 'load', source }
  if ('CheckPointStmt' in obj) return { kind: 'checkpoint', source }
  if ('CreateSubscriptionStmt' in obj) return { kind: 'create_subscription', source }
  if ('AlterSubscriptionStmt' in obj) return { kind: 'alter_subscription', source }
  if ('DropSubscriptionStmt' in obj) return { kind: 'drop_subscription', source }
  if ('CreatePublicationStmt' in obj) return { kind: 'create_publication', source }
  if ('AlterPublicationStmt' in obj) return { kind: 'alter_publication', source }
  if ('ReassignOwnedStmt' in obj) return { kind: 'reassign_owned', source }
  if ('DropOwnedStmt' in obj) return { kind: 'drop_owned', source }
  if ('CallStmt' in obj) return { kind: 'call', source }

  return { kind: 'unknown', raw: node, source }
}

// ============ Transformer - SELECT ============
function transformSelect(raw: Record<string, unknown>): SelectStmt {
  // Handle UNION/INTERSECT/EXCEPT
  if (raw.op && raw.op !== 'SETOP_NONE') {
    const op = raw.op as string
    const opType = op === 'SETOP_UNION' ? 'union' as const :
                   op === 'SETOP_INTERSECT' ? 'intersect' as const : 'except' as const
    return {
      kind: 'select',
      distinct: false,
      distinctOn: null,
      columns: [],
      from: null,
      where: null,
      groupBy: null,
      having: null,
      orderBy: null,
      limit: null,
      offset: null,
      windowClause: null,
      withClause: null,
      setOp: {
        op: opType,
        all: !!raw.all,
        left: transformSelect(raw.larg as Record<string, unknown>),
        right: transformSelect(raw.rarg as Record<string, unknown>),
      },
      lockingClause: null,
    }
  }

  const distinctClause = raw.distinctClause as unknown[] | undefined
  // Check if it's DISTINCT ON (has actual expressions) vs plain DISTINCT ([{}])
  const hasDistinctOn = distinctClause && distinctClause.length > 0 &&
                        Object.keys(distinctClause[0] as object).length > 0

  return {
    kind: 'select',
    distinct: !!distinctClause,
    distinctOn: hasDistinctOn ? distinctClause.map(transformExpr) : null,
    columns: transformTargetList(raw.targetList as unknown[] | undefined),
    from: transformFromClause(raw.fromClause as unknown[] | undefined),
    where: raw.whereClause ? transformExpr(raw.whereClause) : null,
    groupBy: raw.groupClause ? (raw.groupClause as unknown[]).map(transformGroupByItem) : null,
    having: raw.havingClause ? transformExpr(raw.havingClause) : null,
    orderBy: transformSortClause(raw.sortClause as unknown[] | undefined),
    limit: raw.limitCount ? transformExpr(raw.limitCount) : null,
    offset: raw.limitOffset ? transformExpr(raw.limitOffset) : null,
    windowClause: transformWindowClause(raw.windowClause as unknown[] | undefined),
    withClause: transformWithClause(raw.withClause as Record<string, unknown> | undefined),
    setOp: null,
    lockingClause: transformLockingClause(raw.lockingClause as unknown[] | undefined),
  }
}

function transformTargetList(list: unknown[] | undefined): TargetExpr[] {
  if (!list) return []
  return list.map(item => {
    const t = item as Record<string, unknown>
    const resTarget = t.ResTarget as Record<string, unknown>
    return {
      expr: transformExpr(resTarget.val),
      alias: (resTarget.name as string) || null,
    }
  })
}

function transformWithClause(node: Record<string, unknown> | undefined): CTE[] | null {
  if (!node) return null
  const ctes = node.ctes as unknown[]
  const recursive = !!node.recursive
  return ctes.map(cte => {
    const expr = (cte as Record<string, unknown>).CommonTableExpr as Record<string, unknown>
    return {
      name: expr.ctename as string,
      query: transformSelect((expr.ctequery as Record<string, unknown>).SelectStmt as Record<string, unknown>),
      recursive,
    }
  })
}

function transformSortClause(list: unknown[] | undefined): SortExpr[] | null {
  if (!list) return null
  return list.map(item => {
    const sortBy = (item as Record<string, unknown>).SortBy as Record<string, unknown>
    const dir = sortBy.sortby_dir as string
    const nulls = sortBy.sortby_nulls as string
    return {
      expr: transformExpr(sortBy.node),
      direction: dir === 'SORTBY_DESC' ? 'desc' : dir === 'SORTBY_ASC' ? 'asc' : null,
      nulls: nulls === 'SORTBY_NULLS_FIRST' ? 'first' : nulls === 'SORTBY_NULLS_LAST' ? 'last' : null,
    }
  })
}

function transformLockingClause(nodes: unknown[] | undefined): LockingClause[] | null {
  if (!nodes || nodes.length === 0) return null
  return nodes.map(node => {
    const lc = (node as Record<string, unknown>).LockingClause as Record<string, unknown>
    const strength = lc.strength as string
    const strengthMap: Record<string, 'update' | 'no_key_update' | 'share' | 'key_share'> = {
      'LCS_FORUPDATE': 'update',
      'LCS_FORNOKEYUPDATE': 'no_key_update',
      'LCS_FORSHARE': 'share',
      'LCS_FORKEYSHARE': 'key_share',
    }
    const waitPolicy = lc.waitPolicy as string
    const waitPolicyMap: Record<string, 'block' | 'skip_locked' | 'nowait'> = {
      'LockWaitBlock': 'block',
      'LockWaitSkip': 'skip_locked',
      'LockWaitError': 'nowait',
    }
    const lockedRels = lc.lockedRels as unknown[] | undefined
    return {
      strength: strengthMap[strength] || 'update',
      waitPolicy: waitPolicyMap[waitPolicy] || 'block',
      lockedRels: lockedRels ? lockedRels.map(r => {
        const rangeVar = (r as Record<string, unknown>).RangeVar as Record<string, unknown>
        return rangeVar.relname as string
      }) : null,
    }
  })
}

// ============ Transformer - FROM Clause ============
function transformFromClause(list: unknown[] | undefined): FromClause | null {
  if (!list || list.length === 0) return null
  if (list.length === 1) {
    return transformFromItem(list[0] as Record<string, unknown>)
  }
  // Multiple FROM items (comma syntax) - convert to CROSS JOINs
  let result = transformFromItem(list[0] as Record<string, unknown>)
  for (let i = 1; i < list.length; i++) {
    result = {
      kind: 'join',
      type: 'cross',
      left: result,
      right: transformFromItem(list[i] as Record<string, unknown>),
      on: null,
      using: null,
    }
  }
  return result
}

function transformFromItem(node: Record<string, unknown>): FromClause {
  if ('RangeTableSample' in node) {
    const rts = node.RangeTableSample as Record<string, unknown>
    const relation = rts.relation as Record<string, unknown>
    const rv = relation.RangeVar as Record<string, unknown>
    const alias = rts.alias as Record<string, unknown> | undefined
    const method = rts.method as unknown[]
    const methodName = method.length > 0
      ? ((method[0] as Record<string, unknown>).String as { sval: string }).sval
      : 'BERNOULLI' // Default fallback, should not happen
    const args = rts.args as unknown[]

    return {
      kind: 'table',
      schema: (rv.schemaname as string) || null,
      table: rv.relname as string,
      alias: alias?.aliasname as string || null,
      tablesample: {
        method: methodName,
        args: args ? args.map(transformExpr) : [],
        repeatable: rts.repeatable ? transformExpr(rts.repeatable) : null,
      },
    }
  }

  if ('RangeVar' in node) {
    const rv = node.RangeVar as Record<string, unknown>
    const alias = rv.alias as Record<string, unknown> | undefined
    return {
      kind: 'table',
      schema: (rv.schemaname as string) || null,
      table: rv.relname as string,
      alias: alias?.aliasname as string || null,
      tablesample: null,
    }
  }

  if ('RangeSubselect' in node) {
    const rs = node.RangeSubselect as Record<string, unknown>
    const alias = rs.alias as Record<string, unknown>
    const subquery = rs.subquery as Record<string, unknown>
    return {
      kind: 'subquery',
      lateral: !!rs.lateral,
      query: transformSelect(subquery.SelectStmt as Record<string, unknown>),
      alias: alias?.aliasname as string || '',
    }
  }

  if ('JoinExpr' in node) {
    const je = node.JoinExpr as Record<string, unknown>
    const joinType = je.jointype as string
    const typeMap: Record<string, 'inner' | 'left' | 'right' | 'full' | 'cross'> = {
      'JOIN_INNER': 'inner',
      'JOIN_LEFT': 'left',
      'JOIN_RIGHT': 'right',
      'JOIN_FULL': 'full',
    }
    const using = je.usingClause as unknown[] | undefined
    return {
      kind: 'join',
      type: typeMap[joinType] || 'inner',
      left: transformFromItem(je.larg as Record<string, unknown>),
      right: transformFromItem(je.rarg as Record<string, unknown>),
      on: je.quals ? transformExpr(je.quals) : null,
      using: using ? using.map(u => ((u as Record<string, unknown>).String as { sval: string }).sval) : null,
    }
  }

  return { kind: 'table', schema: null, table: '', alias: null, tablesample: null }
}

// ============ Transformer - Expressions ============
function transformGroupByItem(node: unknown): Expr | GroupingSet {
  if (!node || typeof node !== 'object') return transformExpr(node)
  const obj = node as Record<string, unknown>

  if ('GroupingSet' in obj) {
    const gs = obj.GroupingSet as Record<string, unknown>
    const kindMap: Record<string, 'rollup' | 'cube' | 'sets' | 'empty'> = {
      'GROUPING_SET_ROLLUP': 'rollup',
      'GROUPING_SET_CUBE': 'cube',
      'GROUPING_SET_SETS': 'sets',
      'GROUPING_SET_EMPTY': 'empty',
    }
    const kind = kindMap[gs.kind as string] || 'sets'
    const content = gs.content as unknown[] | undefined

    return {
      kind,
      content: content ? content.map(transformGroupByItem) : [],
    }
  }

  return transformExpr(node)
}

function transformExpr(node: unknown): Expr {
  if (!node || typeof node !== 'object') return { kind: 'unknown', raw: node }
  const obj = node as Record<string, unknown>

  if ('ColumnRef' in obj) return transformColumnRef(obj.ColumnRef as Record<string, unknown>)
  if ('A_Const' in obj) return transformConst(obj.A_Const as Record<string, unknown>)
  if ('A_Expr' in obj) return transformAExpr(obj.A_Expr as Record<string, unknown>)
  if ('BoolExpr' in obj) return transformBoolExpr(obj.BoolExpr as Record<string, unknown>)
  if ('FuncCall' in obj) return transformFuncCall(obj.FuncCall as Record<string, unknown>)
  if ('SubLink' in obj) return transformSubLink(obj.SubLink as Record<string, unknown>)
  if ('TypeCast' in obj) return transformTypeCast(obj.TypeCast as Record<string, unknown>)
  if ('NullTest' in obj) return transformNullTest(obj.NullTest as Record<string, unknown>)
  if ('A_ArrayExpr' in obj) return transformArrayExpr(obj.A_ArrayExpr as Record<string, unknown>)
  if ('CoalesceExpr' in obj) return transformCoalesce(obj.CoalesceExpr as Record<string, unknown>)
  if ('CaseExpr' in obj) return transformCase(obj.CaseExpr as Record<string, unknown>)
  if ('ParamRef' in obj) return transformParamRef(obj.ParamRef as Record<string, unknown>)
  if ('RowExpr' in obj) return transformRowExpr(obj.RowExpr as Record<string, unknown>)

  return { kind: 'unknown', raw: node }
}

function transformWindowClause(list: unknown[] | undefined): WindowDef[] | null {
  if (!list || list.length === 0) return null
  return list.map(item => {
    const w = (item as Record<string, unknown>).WindowDef as Record<string, unknown>
    return {
      name: (w.name as string) || null,
      partitionBy: w.partitionClause ? (w.partitionClause as unknown[]).map(transformExpr) : null,
      orderBy: transformSortClause(w.orderClause as unknown[] | undefined),
      frameClause: transformWindowFrame(w),
    }
  })
}

function transformWindowFrame(overNode: Record<string, unknown>): WindowFrameClause | null {
  const frameOptions = overNode.frameOptions as number | undefined
  if (!frameOptions || frameOptions === 0) return null

  // Decode frame type from bitmask
  const FRAMEOPTION_ROWS = 0x00004
  const FRAMEOPTION_RANGE = 0x00002
  const FRAMEOPTION_GROUPS = 0x00008
  const FRAMEOPTION_BETWEEN = 0x00010
  const FRAMEOPTION_START_UNBOUNDED_PRECEDING = 0x00020
  const FRAMEOPTION_START_CURRENT_ROW = 0x00200
  const FRAMEOPTION_START_OFFSET_PRECEDING = 0x00800
  const FRAMEOPTION_START_OFFSET_FOLLOWING = 0x01000
  const FRAMEOPTION_END_UNBOUNDED_PRECEDING = 0x00040
  const FRAMEOPTION_END_UNBOUNDED_FOLLOWING = 0x00100
  const FRAMEOPTION_END_CURRENT_ROW = 0x00400
  const FRAMEOPTION_END_OFFSET_PRECEDING = 0x02000
  const FRAMEOPTION_END_OFFSET_FOLLOWING = 0x04000

  let frameType: 'rows' | 'range' | 'groups'
  if (frameOptions & FRAMEOPTION_ROWS) frameType = 'rows'
  else if (frameOptions & FRAMEOPTION_RANGE) frameType = 'range'
  else if (frameOptions & FRAMEOPTION_GROUPS) frameType = 'groups'
  else return null

  // Decode start bound
  let startBound: WindowFrameBound
  if (frameOptions & FRAMEOPTION_START_UNBOUNDED_PRECEDING) {
    startBound = { type: 'unbounded_preceding', offset: null }
  } else if (frameOptions & FRAMEOPTION_START_CURRENT_ROW) {
    startBound = { type: 'current_row', offset: null }
  } else if (frameOptions & FRAMEOPTION_START_OFFSET_PRECEDING) {
    startBound = { type: 'preceding', offset: overNode.startOffset ? transformExpr(overNode.startOffset) : null }
  } else if (frameOptions & FRAMEOPTION_START_OFFSET_FOLLOWING) {
    startBound = { type: 'following', offset: overNode.startOffset ? transformExpr(overNode.startOffset) : null }
  } else {
    return null
  }

  // Decode end bound (if BETWEEN is specified)
  let endBound: WindowFrameBound | null = null
  if (frameOptions & FRAMEOPTION_BETWEEN) {
    if (frameOptions & FRAMEOPTION_END_UNBOUNDED_FOLLOWING) {
      endBound = { type: 'unbounded_following', offset: null }
    } else if (frameOptions & FRAMEOPTION_END_CURRENT_ROW) {
      endBound = { type: 'current_row', offset: null }
    } else if (frameOptions & FRAMEOPTION_END_OFFSET_PRECEDING) {
      endBound = { type: 'preceding', offset: overNode.endOffset ? transformExpr(overNode.endOffset) : null }
    } else if (frameOptions & FRAMEOPTION_END_OFFSET_FOLLOWING) {
      endBound = { type: 'following', offset: overNode.endOffset ? transformExpr(overNode.endOffset) : null }
    } else if (frameOptions & FRAMEOPTION_END_UNBOUNDED_PRECEDING) {
      endBound = { type: 'unbounded_preceding', offset: null }
    }
  }

  return {
    type: frameType,
    start: startBound,
    end: endBound,
  }
}

function transformColumnRef(node: Record<string, unknown>): ColumnRef {
  const fields = node.fields as unknown[]
  const parts = fields.map(f => {
    const field = f as Record<string, unknown>
    if ('String' in field) return (field.String as { sval: string }).sval
    if ('A_Star' in field) return '*'
    return ''
  })
  if (parts.length === 1) {
    return { kind: 'column', table: null, column: parts[0] }
  }
  return { kind: 'column', table: parts[0], column: parts[1] }
}

function transformConst(node: Record<string, unknown>): Literal {
  if ('ival' in node) {
    return { kind: 'literal', type: 'number', value: (node.ival as { ival: number }).ival }
  }
  if ('fval' in node) {
    return { kind: 'literal', type: 'number', value: parseFloat((node.fval as { fval: string }).fval) }
  }
  if ('sval' in node) {
    return { kind: 'literal', type: 'string', value: (node.sval as { sval: string }).sval }
  }
  if ('boolval' in node) {
    return { kind: 'literal', type: 'boolean', value: (node.boolval as { boolval: boolean }).boolval }
  }
  return { kind: 'literal', type: 'null', value: null }
}

function transformAExpr(node: Record<string, unknown>): BinaryOp | UnaryOp {
  const left = node.lexpr ? transformExpr(node.lexpr) : null
  const right = node.rexpr ? transformExpr(node.rexpr) : null
  const opName = node.name as unknown[] | undefined
  const op = opName ? ((opName[0] as Record<string, unknown>)?.String as { sval: string })?.sval : '='

  const kind = node.kind as string
  if (kind === 'AEXPR_IN') {
    return { kind: 'binary', op: 'IN', left: left!, right: right! }
  }
  if (kind === 'AEXPR_LIKE') {
    return { kind: 'binary', op: 'LIKE', left: left!, right: right! }
  }
  if (kind === 'AEXPR_BETWEEN') {
    return { kind: 'binary', op: 'BETWEEN', left: left!, right: right! }
  }

  return { kind: 'binary', op: op.toUpperCase(), left: left!, right: right! }
}

function transformBoolExpr(node: Record<string, unknown>): BinaryOp | UnaryOp {
  const args = (node.args as unknown[]).map(transformExpr)
  const boolop = node.boolop as string

  if (boolop === 'NOT_EXPR') {
    return { kind: 'unary', op: 'NOT', arg: args[0] }
  }
  if (boolop === 'AND_EXPR') {
    return args.reduce((left, right) => ({ kind: 'binary', op: 'AND', left, right })) as BinaryOp
  }
  if (boolop === 'OR_EXPR') {
    return args.reduce((left, right) => ({ kind: 'binary', op: 'OR', left, right })) as BinaryOp
  }
  return { kind: 'binary', op: 'AND', left: args[0], right: args[1] }
}

function transformFuncCall(node: Record<string, unknown>): FuncCall {
  const funcname = (node.funcname as unknown[])
    .map(f => ((f as Record<string, unknown>).String as { sval: string }).sval)
    .join('.')
  const args = node.args ? (node.args as unknown[]).map(transformExpr) : []

  let over: WindowDef | null = null
  if (node.over) {
    const overNode = node.over as Record<string, unknown>
    over = {
      name: (overNode.name as string) || null,
      partitionBy: overNode.partitionClause ? (overNode.partitionClause as unknown[]).map(transformExpr) : null,
      orderBy: transformSortClause(overNode.orderClause as unknown[] | undefined),
      frameClause: transformWindowFrame(overNode),
    }
  }

  return {
    kind: 'func',
    name: funcname.toUpperCase(),
    args,
    distinct: !!node.agg_distinct,
    star: !!node.agg_star,
    filter: node.agg_filter ? transformExpr(node.agg_filter) : null,
    over,
  }
}

function transformSubLink(node: Record<string, unknown>): SubLink {
  const subselect = node.subselect as Record<string, unknown>
  const kind = node.subLinkType as string
  const typeMap: Record<string, 'exists' | 'any' | 'all' | 'scalar'> = {
    'EXISTS_SUBLINK': 'exists',
    'ANY_SUBLINK': 'any',
    'ALL_SUBLINK': 'all',
    'EXPR_SUBLINK': 'scalar',
  }
  return {
    kind: 'sublink',
    type: typeMap[kind] || 'scalar',
    subquery: transformSelect(subselect.SelectStmt as Record<string, unknown>),
    testExpr: node.testexpr ? transformExpr(node.testexpr) : null,
  }
}

function transformTypeCast(node: Record<string, unknown>): TypeCast {
  const typeName = node.typeName as Record<string, unknown>
  const names = typeName.names as unknown[]
  const type = names
    .map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval)
    .filter(Boolean)
    .pop() ?? ''
  return {
    kind: 'typecast',
    arg: transformExpr(node.arg),
    type: type.toUpperCase(),
  }
}

function transformNullTest(node: Record<string, unknown>): NullTest {
  return {
    kind: 'nulltest',
    arg: transformExpr(node.arg),
    isNull: node.nulltesttype === 'IS_NULL',
  }
}

function transformArrayExpr(node: Record<string, unknown>): ArrayExpr {
  const elements = node.elements as unknown[] | undefined
  return {
    kind: 'array',
    elements: elements ? elements.map(transformExpr) : [],
  }
}

function transformCoalesce(node: Record<string, unknown>): CoalesceExpr {
  return {
    kind: 'coalesce',
    args: (node.args as unknown[]).map(transformExpr),
  }
}

function transformCase(node: Record<string, unknown>): CaseExpr {
  const whens = (node.args as unknown[]).map(w => {
    const when = (w as Record<string, unknown>).CaseWhen as Record<string, unknown>
    return {
      when: transformExpr(when.expr),
      then: transformExpr(when.result),
    }
  })
  return {
    kind: 'case',
    arg: node.arg ? transformExpr(node.arg) : null,
    whens,
    else: node.defresult ? transformExpr(node.defresult) : null,
  }
}

function transformParamRef(node: Record<string, unknown>): ParamRef {
  return {
    kind: 'param',
    number: node.number as number,
  }
}

function transformRowExpr(node: Record<string, unknown>): RowExpr {
  const args = (node.args as unknown[]) || []
  return {
    kind: 'row',
    args: args.map(transformExpr),
  }
}

// ============ Transformer - INSERT ============
function transformInsert(raw: Record<string, unknown>): InsertStmt {
  const relation = raw.relation as Record<string, unknown>
  const alias = relation.alias as Record<string, unknown> | undefined

  // Extract column names
  const cols = raw.cols as unknown[] | undefined
  const columns = cols
    ? cols.map(c => ((c as Record<string, unknown>).ResTarget as Record<string, unknown>).name as string)
    : null

  // Handle VALUES vs SELECT
  const selectStmt = raw.selectStmt as Record<string, unknown> | undefined
  const innerSelect = selectStmt?.SelectStmt as Record<string, unknown> | undefined

  let values: Expr[][] | null = null
  let select: SelectStmt | null = null

  if (innerSelect?.valuesLists) {
    // VALUES clause
    const valuesLists = innerSelect.valuesLists as unknown[]
    values = valuesLists.map(list => {
      const items = ((list as Record<string, unknown>).List as Record<string, unknown>).items as unknown[]
      return items.map(transformExpr)
    })
  } else if (innerSelect) {
    // INSERT ... SELECT
    select = transformSelect(innerSelect)
  }

  // RETURNING clause
  const returningList = raw.returningList as unknown[] | undefined

  // ON CONFLICT clause
  const onConflictClause = raw.onConflictClause as Record<string, unknown> | undefined

  return {
    kind: 'insert',
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: alias?.aliasname as string || null,
      tablesample: null,
    },
    columns,
    values,
    select,
    onConflict: onConflictClause ? transformOnConflict(onConflictClause) : null,
    returning: returningList ? transformTargetList(returningList) : null,
  }
}

function transformOnConflict(raw: Record<string, unknown>): OnConflictClause {
  const action = raw.action as string
  const actionType = action === 'ONCONFLICT_UPDATE' ? 'update' : 'nothing'

  // Extract conflict target columns
  const infer = raw.infer as Record<string, unknown> | undefined
  const indexElems = infer?.indexElems as unknown[] | undefined
  const target = indexElems ? indexElems.map(elem => {
    const indexElem = (elem as Record<string, unknown>).IndexElem as Record<string, unknown>
    return indexElem.name as string
  }) : null

  // Extract SET assignments for DO UPDATE
  const targetList = raw.targetList as unknown[] | undefined
  const assignments = targetList ? targetList.map(item => {
    const resTarget = (item as Record<string, unknown>).ResTarget as Record<string, unknown>
    return {
      column: resTarget.name as string,
      value: transformExpr(resTarget.val),
    }
  }) : null

  // Extract WHERE clause for DO UPDATE
  const whereClause = raw.whereClause ? transformExpr(raw.whereClause) : null

  return {
    action: actionType,
    target,
    assignments,
    where: whereClause,
  }
}

// ============ Transformer - UPDATE ============
function transformUpdate(raw: Record<string, unknown>): UpdateStmt {
  const relation = raw.relation as Record<string, unknown>
  const alias = relation.alias as Record<string, unknown> | undefined

  // SET clause
  const targetList = raw.targetList as unknown[]
  const assignments = targetList.map(item => {
    const resTarget = (item as Record<string, unknown>).ResTarget as Record<string, unknown>
    return {
      column: resTarget.name as string,
      value: transformExpr(resTarget.val),
    }
  })

  // RETURNING clause
  const returningList = raw.returningList as unknown[] | undefined

  return {
    kind: 'update',
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: alias?.aliasname as string || null,
      tablesample: null,
    },
    assignments,
    from: transformFromClause(raw.fromClause as unknown[] | undefined),
    where: raw.whereClause ? transformExpr(raw.whereClause) : null,
    returning: returningList ? transformTargetList(returningList) : null,
  }
}

// ============ Transformer - DELETE ============
function transformDelete(raw: Record<string, unknown>): DeleteStmt {
  const relation = raw.relation as Record<string, unknown>
  const alias = relation.alias as Record<string, unknown> | undefined

  // RETURNING clause
  const returningList = raw.returningList as unknown[] | undefined

  return {
    kind: 'delete',
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: alias?.aliasname as string || null,
      tablesample: null,
    },
    using: transformFromClause(raw.usingClause as unknown[] | undefined),
    where: raw.whereClause ? transformExpr(raw.whereClause) : null,
    returning: returningList ? transformTargetList(returningList) : null,
  }
}

// ============ Transformer - CREATE TABLE ============
function transformCreateTable(raw: Record<string, unknown>): CreateTableStmt {
  const relation = raw.relation as Record<string, unknown>

  // Parse table elements (columns and constraints)
  const tableElts = raw.tableElts as unknown[] | undefined
  const columns: ColumnDef[] = []
  const constraints: TableConstraint[] = []

  if (tableElts) {
    for (const elt of tableElts) {
      const eltObj = elt as Record<string, unknown>

      if ('ColumnDef' in eltObj) {
        columns.push(transformColumnDef(eltObj.ColumnDef as Record<string, unknown>))
      } else if ('Constraint' in eltObj) {
        const constraint = transformTableConstraint(eltObj.Constraint as Record<string, unknown>)
        if (constraint) constraints.push(constraint)
      }
    }
  }

  return {
    kind: 'create_table',
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: null,
      tablesample: null,
    },
    columns,
    constraints,
    ifNotExists: !!raw.if_not_exists,
  }
}

function transformColumnDef(raw: Record<string, unknown>): ColumnDef {
  const colname = raw.colname as string

  // Parse type name
  const typeName = raw.typeName as Record<string, unknown> | undefined
  let type = ''
  if (typeName) {
    const names = typeName.names as unknown[] | undefined
    if (names) {
      type = names
        .map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval)
        .filter(Boolean)
        .pop() ?? ''
    }
    // Handle type modifiers (e.g., varchar(255), numeric(10,2))
    const typmods = typeName.typmods as unknown[] | undefined
    if (typmods && typmods.length > 0) {
      const modValues = typmods.map(m => {
        const constVal = (m as Record<string, unknown>).A_Const as Record<string, unknown> | undefined
        if (constVal?.ival) return (constVal.ival as { ival: number }).ival
        if (constVal?.sval) return (constVal.sval as { sval: string }).sval
        return ''
      }).filter(v => v !== '')
      if (modValues.length > 0) {
        type += `(${modValues.join(', ')})`
      }
    }
    // Handle array types
    const arrayBounds = typeName.arrayBounds as unknown[] | undefined
    if (arrayBounds && arrayBounds.length > 0) {
      type += '[]'
    }
  }

  // Parse constraints
  const rawConstraints = raw.constraints as unknown[] | undefined
  const colConstraints: ColumnConstraint[] = []
  let nullable = true
  let defaultExpr: Expr | null = null

  if (rawConstraints) {
    for (const c of rawConstraints) {
      const constraint = (c as Record<string, unknown>).Constraint as Record<string, unknown>
      const contype = constraint.contype as string
      const conname = constraint.conname as string | undefined

      if (contype === 'CONSTR_NOTNULL') {
        nullable = false
        colConstraints.push({ type: 'not_null', name: conname || null })
      } else if (contype === 'CONSTR_PRIMARY') {
        colConstraints.push({ type: 'primary_key', name: conname || null })
      } else if (contype === 'CONSTR_UNIQUE') {
        colConstraints.push({ type: 'unique', name: conname || null })
      } else if (contype === 'CONSTR_DEFAULT') {
        defaultExpr = constraint.raw_expr ? transformExpr(constraint.raw_expr) : null
      } else if (contype === 'CONSTR_CHECK') {
        colConstraints.push({ type: 'check', name: conname || null })
      } else if (contype === 'CONSTR_FOREIGN') {
        colConstraints.push({ type: 'references', name: conname || null })
      }
    }
  }

  return {
    name: colname,
    type,
    nullable,
    default: defaultExpr,
    constraints: colConstraints,
  }
}

function transformTableConstraint(raw: Record<string, unknown>): TableConstraint | null {
  const contype = raw.contype as string
  const conname = raw.conname as string | undefined

  // Get column keys
  const keys = raw.keys as unknown[] | undefined
  const columns = keys
    ? keys.map(k => ((k as Record<string, unknown>).String as { sval: string }).sval)
    : []

  if (contype === 'CONSTR_PRIMARY') {
    return { type: 'primary_key', name: conname || null, columns }
  } else if (contype === 'CONSTR_UNIQUE') {
    return { type: 'unique', name: conname || null, columns }
  } else if (contype === 'CONSTR_CHECK') {
    return { type: 'check', name: conname || null, columns: [] }
  } else if (contype === 'CONSTR_FOREIGN') {
    return { type: 'foreign_key', name: conname || null, columns }
  }

  return null
}

// ============ Transformer - ALTER TABLE ============
function transformAlterTable(raw: Record<string, unknown>): AlterTableStmt {
  const relation = raw.relation as Record<string, unknown>
  const cmds = raw.cmds as unknown[] | undefined

  const commands: AlterTableCmd[] = []

  if (cmds) {
    for (const cmd of cmds) {
      const alterCmd = (cmd as Record<string, unknown>).AlterTableCmd as Record<string, unknown>
      const subtype = alterCmd.subtype as string
      const name = alterCmd.name as string | undefined
      const def = alterCmd.def as Record<string, unknown> | undefined
      const missingOk = !!alterCmd.missing_ok

      switch (subtype) {
        case 'AT_AddColumn':
          if (def && 'ColumnDef' in def) {
            commands.push({
              type: 'add_column',
              column: transformColumnDef(def.ColumnDef as Record<string, unknown>),
            })
          }
          break

        case 'AT_DropColumn':
          if (name) {
            commands.push({
              type: 'drop_column',
              column: name,
              ifExists: missingOk,
            })
          }
          break

        case 'AT_AlterColumnType':
          if (name && def && 'ColumnDef' in def) {
            const colDef = def.ColumnDef as Record<string, unknown>
            const typeName = colDef.typeName as Record<string, unknown> | undefined
            let dataType = ''
            if (typeName) {
              const names = typeName.names as unknown[] | undefined
              if (names) {
                dataType = names
                  .map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval)
                  .filter(Boolean)
                  .pop() ?? ''
              }
              // Handle type modifiers
              const typmods = typeName.typmods as unknown[] | undefined
              if (typmods && typmods.length > 0) {
                const modValues = typmods.map(m => {
                  const constVal = (m as Record<string, unknown>).A_Const as Record<string, unknown> | undefined
                  if (constVal?.ival) return (constVal.ival as { ival: number }).ival
                  if (constVal?.sval) return (constVal.sval as { sval: string }).sval
                  return ''
                }).filter(v => v !== '')
                if (modValues.length > 0) {
                  dataType += `(${modValues.join(', ')})`
                }
              }
            }
            commands.push({
              type: 'alter_column_type',
              column: name,
              dataType,
            })
          }
          break

        case 'AT_SetNotNull':
          if (name) {
            commands.push({ type: 'set_not_null', column: name })
          }
          break

        case 'AT_DropNotNull':
          if (name) {
            commands.push({ type: 'drop_not_null', column: name })
          }
          break

        case 'AT_ColumnDefault':
          if (name) {
            if (def) {
              commands.push({
                type: 'set_default',
                column: name,
                default: transformExpr(def),
              })
            } else {
              commands.push({ type: 'drop_default', column: name })
            }
          }
          break

        case 'AT_AddConstraint':
          if (def && 'Constraint' in def) {
            const constraint = transformTableConstraint(def.Constraint as Record<string, unknown>)
            if (constraint) {
              commands.push({ type: 'add_constraint', constraint })
            }
          }
          break

        case 'AT_DropConstraint':
          if (name) {
            commands.push({
              type: 'drop_constraint',
              name,
              ifExists: missingOk,
            })
          }
          break
      }
    }
  }

  return {
    kind: 'alter_table',
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: null,
      tablesample: null,
    },
    commands,
  }
}

// ============ Transformer - DROP ============
function transformDrop(raw: Record<string, unknown>, source: string): DropStmt {
  const removeType = raw.removeType as string

  // Map PostgreSQL object types to our simplified types
  const typeMap: Record<string, DropStmt['objectType']> = {
    'OBJECT_TABLE': 'table',
    'OBJECT_VIEW': 'view',
    'OBJECT_MATVIEW': 'materialized_view',
    'OBJECT_INDEX': 'index',
    'OBJECT_FUNCTION': 'function',
    'OBJECT_PROCEDURE': 'procedure',
    'OBJECT_SCHEMA': 'schema',
    'OBJECT_TRIGGER': 'trigger',
  }

  const objectType = typeMap[removeType] || 'other'

  // Parse objects list
  const objectsList = raw.objects as unknown[] | undefined
  const objects: DropStmt['objects'] = []

  if (objectsList) {
    for (const obj of objectsList) {
      if (objectType === 'function' || objectType === 'procedure') {
        // Functions/procedures have ObjectWithArgs structure
        const objWithArgs = (obj as Record<string, unknown>).ObjectWithArgs as Record<string, unknown> | undefined
        if (objWithArgs) {
          const objname = objWithArgs.objname as unknown[] | undefined
          if (objname) {
            const parts = objname.map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval).filter(Boolean)
            const name = parts.pop() || ''
            const schema = parts.length > 0 ? parts[0] : null
            // Extract argument types
            const objargs = objWithArgs.objargs as unknown[] | undefined
            const args = objargs
              ? objargs.map(a => {
                  const typeName = (a as Record<string, unknown>).TypeName as Record<string, unknown> | undefined
                  if (typeName) {
                    const names = typeName.names as unknown[] | undefined
                    return names?.map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval).filter(Boolean).pop() || ''
                  }
                  return ''
                }).filter(Boolean).join(', ')
              : undefined
            objects.push({ schema, name, args })
          }
        }
      } else {
        // Regular objects have List structure with String elements
        const list = (obj as Record<string, unknown>).List as Record<string, unknown> | undefined
        if (list) {
          const items = list.items as unknown[] | undefined
          if (items) {
            const parts = items.map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval).filter(Boolean)
            const name = parts.pop() || ''
            const schema = parts.length > 0 ? parts[0] : null
            objects.push({ schema, name })
          }
        }
      }
    }
  }

  return {
    kind: 'drop',
    objectType,
    objects,
    ifExists: !!raw.missing_ok,
    cascade: raw.behavior === 'DROP_CASCADE',
    source,
  }
}

// ============ Transformer - CREATE VIEW ============
function transformCreateView(raw: Record<string, unknown>, source: string): CreateViewStmt {
  const view = raw.view as Record<string, unknown>
  const query = raw.query as Record<string, unknown>

  return {
    kind: 'create_view',
    view: {
      kind: 'table',
      schema: (view.schemaname as string) || null,
      table: view.relname as string,
      alias: null,
      tablesample: null,
    },
    query: transformSelect(query.SelectStmt as Record<string, unknown>),
    replace: !!raw.replace,
    materialized: false,
    ifNotExists: false,
    source,
  }
}

// ============ Transformer - CREATE TABLE AS (Materialized View) ============
function transformCreateTableAs(raw: Record<string, unknown>, source: string): CreateViewStmt {
  const into = raw.into as Record<string, unknown>
  const rel = into.rel as Record<string, unknown>
  const query = raw.query as Record<string, unknown>

  return {
    kind: 'create_view',
    view: {
      kind: 'table',
      schema: (rel.schemaname as string) || null,
      table: rel.relname as string,
      alias: null,
      tablesample: null,
    },
    query: transformSelect(query.SelectStmt as Record<string, unknown>),
    replace: false,
    materialized: raw.objtype === 'OBJECT_MATVIEW',
    ifNotExists: !!raw.if_not_exists,
    source,
  }
}

// ============ Transformer - CREATE INDEX ============
function transformCreateIndex(raw: Record<string, unknown>, source: string): CreateIndexStmt {
  const relation = raw.relation as Record<string, unknown>

  // Parse index columns
  const indexParams = raw.indexParams as unknown[] | undefined
  const columns: CreateIndexStmt['columns'] = []

  if (indexParams) {
    for (const param of indexParams) {
      const indexElem = (param as Record<string, unknown>).IndexElem as Record<string, unknown>
      if (indexElem) {
        const name = indexElem.name as string | undefined
        const ordering = indexElem.ordering as string | undefined
        if (name) {
          columns.push({
            name,
            order: ordering === 'SORTBY_DESC' ? 'desc' : ordering === 'SORTBY_ASC' ? 'asc' : null,
          })
        }
      }
    }
  }

  return {
    kind: 'create_index',
    name: (raw.idxname as string) || null,
    table: {
      kind: 'table',
      schema: (relation.schemaname as string) || null,
      table: relation.relname as string,
      alias: null,
      tablesample: null,
    },
    columns,
    unique: !!raw.unique,
    concurrent: !!raw.concurrent,
    ifNotExists: !!raw.if_not_exists,
    source,
  }
}

// ============ Transformer - CREATE FUNCTION/PROCEDURE ============
function transformCreateFunction(raw: Record<string, unknown>, source: string): CreateFunctionStmt {
  // Parse function name
  const funcname = raw.funcname as unknown[] | undefined
  const nameParts = funcname?.map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval).filter(Boolean) || []
  const name = nameParts.pop() || ''
  const schema = nameParts.length > 0 ? nameParts[0] : null

  // Parse parameters with full details
  const rawParameters = raw.parameters as unknown[] | undefined
  const parameters: FunctionParameter[] = []
  const returnsTableColumns: FunctionParameter[] = []

  if (rawParameters) {
    for (const param of rawParameters) {
      const funcParam = (param as Record<string, unknown>).FunctionParameter as Record<string, unknown>
      if (funcParam) {
        const paramMode = funcParam.mode as string | undefined
        const modeMap: Record<string, FunctionParameter['mode']> = {
          'FUNC_PARAM_IN': 'in',
          'FUNC_PARAM_OUT': 'out',
          'FUNC_PARAM_INOUT': 'inout',
          'FUNC_PARAM_VARIADIC': 'variadic',
          'FUNC_PARAM_TABLE': 'table',
          'FUNC_PARAM_DEFAULT': null,
        }
        const mode = paramMode ? (modeMap[paramMode] ?? null) : null

        const paramName = funcParam.name as string | undefined
        const argType = funcParam.argType as Record<string, unknown> | undefined
        const typeName = extractTypeName(argType)

        // Extract default expression if present
        const defexpr = funcParam.defexpr as unknown | undefined
        let defaultVal: string | null = null
        if (defexpr) {
          // Try to extract the source text for the default expression
          // For now, we'll use a simplified approach
          defaultVal = extractExprSource(defexpr, source)
        }

        const fp: FunctionParameter = {
          name: paramName || null,
          type: typeName,
          mode,
          default: defaultVal,
        }

        // TABLE mode parameters are return columns
        if (mode === 'table') {
          returnsTableColumns.push(fp)
        } else {
          parameters.push(fp)
        }
      }
    }
  }

  // Parse return type
  const returnType = raw.returnType as Record<string, unknown> | undefined
  let returnTypeName: string | null = null
  let returnsSetOf = false
  if (returnType) {
    returnTypeName = extractTypeName(returnType)
    returnsSetOf = !!returnType.setof
  }

  // Parse options
  const options = raw.options as unknown[] | undefined
  let language: string | null = null
  let volatility: CreateFunctionStmt['volatility'] = null
  let strict: boolean | null = null
  let securityDefiner: boolean | null = null
  let leakproof: boolean | null = null
  let cost: number | null = null
  let rows: number | null = null
  let parallel: CreateFunctionStmt['parallel'] = null
  let body: string[] | null = null

  if (options) {
    for (const opt of options) {
      const defElem = (opt as Record<string, unknown>).DefElem as Record<string, unknown>
      if (!defElem) continue

      const defname = defElem.defname as string
      const arg = defElem.arg as Record<string, unknown> | undefined

      switch (defname) {
        case 'language':
          if (arg && 'String' in arg) {
            language = (arg.String as { sval: string }).sval
          }
          break
        case 'volatility':
          if (arg && 'String' in arg) {
            const val = (arg.String as { sval: string }).sval
            if (val === 'immutable' || val === 'stable' || val === 'volatile') {
              volatility = val
            }
          }
          break
        case 'strict':
          if (arg && 'Boolean' in arg) {
            strict = (arg.Boolean as { boolval: boolean }).boolval
          }
          break
        case 'security':
          if (arg && 'Boolean' in arg) {
            securityDefiner = (arg.Boolean as { boolval: boolean }).boolval
          }
          break
        case 'leakproof':
          if (arg && 'Boolean' in arg) {
            leakproof = (arg.Boolean as { boolval: boolean }).boolval
          }
          break
        case 'cost':
          if (arg) {
            const numVal = extractNumericValue(arg)
            if (numVal !== null) cost = numVal
          }
          break
        case 'rows':
          if (arg) {
            const numVal = extractNumericValue(arg)
            if (numVal !== null) rows = numVal
          }
          break
        case 'parallel':
          if (arg && 'String' in arg) {
            const val = (arg.String as { sval: string }).sval.toLowerCase()
            if (val === 'safe' || val === 'restricted' || val === 'unsafe') {
              parallel = val
            }
          }
          break
        case 'as':
          if (arg && 'List' in arg) {
            const list = arg.List as { items: unknown[] }
            body = list.items.map(item => {
              const str = (item as Record<string, unknown>).String as { sval: string } | undefined
              return str?.sval || ''
            }).filter(Boolean)
          }
          break
      }
    }
  }

  return {
    kind: 'create_function',
    name,
    schema,
    parameters,
    returnType: returnTypeName,
    returnsSetOf,
    returnsTable: returnsTableColumns.length > 0 ? returnsTableColumns : null,
    replace: !!raw.replace,
    language,
    isProcedure: !!raw.is_procedure,
    volatility,
    strict,
    securityDefiner,
    leakproof,
    cost,
    rows,
    parallel,
    body,
    source,
  }
}

function extractTypeName(typeNode: Record<string, unknown> | undefined): string {
  if (!typeNode) return ''

  const names = typeNode.names as unknown[] | undefined
  let typeName = names
    ?.map(n => ((n as Record<string, unknown>).String as { sval: string })?.sval)
    .filter(Boolean)
    .pop() || ''

  // Handle type modifiers (e.g., varchar(255), numeric(10,2))
  const typmods = typeNode.typmods as unknown[] | undefined
  if (typmods && typmods.length > 0) {
    const modValues = typmods.map(m => {
      const constVal = (m as Record<string, unknown>).A_Const as Record<string, unknown> | undefined
      if (constVal?.ival) return (constVal.ival as { ival: number }).ival
      if (constVal?.sval) return (constVal.sval as { sval: string }).sval
      return ''
    }).filter(v => v !== '')
    if (modValues.length > 0) {
      typeName += `(${modValues.join(', ')})`
    }
  }

  // Handle array types
  const arrayBounds = typeNode.arrayBounds as unknown[] | undefined
  if (arrayBounds && arrayBounds.length > 0) {
    typeName += '[]'
  }

  // Handle SETOF prefix
  if (typeNode.setof) {
    typeName = 'SETOF ' + typeName
  }

  return typeName
}

function extractNumericValue(node: Record<string, unknown>): number | null {
  if ('Integer' in node) {
    return (node.Integer as { ival: number }).ival
  }
  if ('Float' in node) {
    return parseFloat((node.Float as { fval: string }).fval)
  }
  return null
}

function extractExprSource(expr: unknown, _fullSource: string): string | null {
  // Try to extract source text based on location info
  if (!expr || typeof expr !== 'object') return null
  const obj = expr as Record<string, unknown>

  // Check for A_Const (literal values)
  if ('A_Const' in obj) {
    const aconst = obj.A_Const as Record<string, unknown>
    if ('ival' in aconst) {
      return String((aconst.ival as { ival: number }).ival)
    }
    if ('fval' in aconst) {
      return (aconst.fval as { fval: string }).fval
    }
    if ('sval' in aconst) {
      return `'${(aconst.sval as { sval: string }).sval}'`
    }
    if ('boolval' in aconst) {
      return (aconst.boolval as { boolval: boolean }).boolval ? 'TRUE' : 'FALSE'
    }
  }

  // For complex expressions, try to extract based on location
  // This is a simplified approach - for complex defaults, we might need more work
  return null
}

// ============ Transformer - TRUNCATE ============
function transformTruncate(raw: Record<string, unknown>, source: string): TruncateStmt {
  const relations = raw.relations as unknown[] | undefined
  const tables: TableRef[] = []

  if (relations) {
    for (const rel of relations) {
      const rangeVar = (rel as Record<string, unknown>).RangeVar as Record<string, unknown>
      if (rangeVar) {
        tables.push({
          kind: 'table',
          schema: (rangeVar.schemaname as string) || null,
          table: rangeVar.relname as string,
          alias: null,
          tablesample: null,
        })
      }
    }
  }

  return {
    kind: 'truncate',
    tables,
    cascade: raw.behavior === 'DROP_CASCADE',
    restartIdentity: !!raw.restart_seqs,
    source,
  }
}

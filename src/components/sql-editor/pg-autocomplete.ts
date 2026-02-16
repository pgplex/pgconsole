/**
 * PostgreSQL Autocomplete for CodeMirror
 *
 * BEHAVIORS:
 *
 * 1. WHITESPACE: Controlled by getInsertText() in the autocomplete pipeline.
 *    Only keywords get trailing space. Tables/columns do not.
 *
 * 2. RETRIGGER: After selecting keywords (SELECT, FROM, WHERE, etc.) or
 *    dot-qualified tables, autocomplete automatically reopens. See RETRIGGER_KEYWORDS.
 *    Retrigger does NOT inject whitespace — it only calls startCompletion().
 *
 * 3. ICONS: Lucide-style icons for database objects (matches sidebar):
 *    - table: Grid3x3 icon (gold/yellow)
 *    - view: Eye icon (blue)
 *    - column: Box icon (gray)
 *    - function: FunctionSquare icon (purple)
 *    - procedure: Code icon (teal)
 *    - keyword: Hash icon (gray)
 *
 * 4. ON-DEMAND COLUMNS: Columns are fetched when needed (after "table.")
 *
 * Modern autocomplete pipeline: src/lib/sql/autocomplete/
 */

import {
  autocompletion,
  startCompletion,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import { schemaStore } from '@/lib/schema-store'
import {
  autocomplete,
  isMatch,
  tokenize,
  extractCurrentStatement,
  type SchemaInfo,
  type RankedSuggestion,
  type CandidateType,
  type SQLSection,
} from '@/lib/sql/autocomplete'
import { PG_SYSTEM_FUNCTIONS } from '@/lib/sql/pg-system-functions'
import { queryClient as rpcClient } from '@/lib/connect-client'
import { RETRIGGER_KEYWORDS } from '@/lib/sql/completions'

// ============================================================================
// CUSTOM ICONS (lucide-style)
// ============================================================================

type IconElement = { tag: string; attrs: Record<string, string> }

const ICON_ELEMENTS: Record<string, IconElement[]> = {
  // Grid3x3 for tables (matches sidebar)
  table: [
    { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2' } },
    { tag: 'path', attrs: { d: 'M3 9h18' } },
    { tag: 'path', attrs: { d: 'M3 15h18' } },
    { tag: 'path', attrs: { d: 'M9 3v18' } },
    { tag: 'path', attrs: { d: 'M15 3v18' } },
  ],
  // Eye for views (matches sidebar)
  view: [
    { tag: 'path', attrs: { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' } },
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
  ],
  // Box for columns
  column: [
    { tag: 'path', attrs: { d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' } },
    { tag: 'path', attrs: { d: 'm3.3 7 8.7 5 8.7-5' } },
    { tag: 'path', attrs: { d: 'M12 22V12' } },
  ],
  // FunctionSquare for functions (matches sidebar)
  function: [
    { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2', ry: '2' } },
    { tag: 'path', attrs: { d: 'M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3' } },
    { tag: 'path', attrs: { d: 'M9 11.2h5.7' } },
  ],
  // Code for procedures (matches sidebar)
  procedure: [
    { tag: 'path', attrs: { d: 'm16 18 6-6-6-6' } },
    { tag: 'path', attrs: { d: 'm8 6-6 6 6 6' } },
  ],
  // Hash for keywords
  keyword: [
    { tag: 'line', attrs: { x1: '4', x2: '20', y1: '9', y2: '9' } },
    { tag: 'line', attrs: { x1: '4', x2: '20', y1: '15', y2: '15' } },
    { tag: 'line', attrs: { x1: '10', x2: '8', y1: '3', y2: '21' } },
    { tag: 'line', attrs: { x1: '16', x2: '14', y1: '3', y2: '21' } },
  ],
}

const ICON_COLORS: Record<string, string> = {
  table: '#c4a000',    // gold
  view: '#4a90d9',     // blue
  column: '#6b7280',   // gray
  function: '#a855f7', // purple
  procedure: '#14b8a6', // teal
  keyword: '#6b7280',  // gray
}

/**
 * Creates an SVG icon element for a completion type.
 */
function createIconElement(type: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.style.display = 'inline-flex'
  span.style.alignItems = 'center'
  span.style.marginRight = '6px'
  span.style.verticalAlign = 'middle'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', ICON_COLORS[type] || '#6b7280')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.style.display = 'block'

  const elements = ICON_ELEMENTS[type] || ICON_ELEMENTS.keyword
  for (const el of elements) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag)
    for (const [key, value] of Object.entries(el.attrs)) {
      node.setAttribute(key, value)
    }
    svg.appendChild(node)
  }
  span.appendChild(svg)

  return span
}

/** Maps RankedSuggestion type to our icon type. */
const ICON_TYPE_MAP: Record<CandidateType, string> = {
  table: 'table',
  view: 'view',
  column: 'column',
  function: 'function',
  procedure: 'procedure',
  keyword: 'keyword',
  cte: 'table',      // CTEs display as tables
  alias: 'column',   // Aliases display as columns
  schema: 'table',   // Schemas display like tables
  operator: 'keyword',
}

/** Maps RankedSuggestion type to CodeMirror completion type. */
const CODEMIRROR_TYPE_MAP: Record<CandidateType, string> = {
  table: 'variable',    // Gold Grid3x3 icon
  view: 'class',        // Blue Eye icon
  column: 'property',   // Gray cell icon
  function: 'function', // Purple FunctionSquare icon
  procedure: 'method',  // Teal Code icon
  keyword: 'keyword',   // Gray text icon
  cte: 'variable',      // CTEs are like tables
  alias: 'property',    // Aliases are like columns
  schema: 'namespace',
  operator: 'keyword',
}

// ============================================================================
// MATCH HIGHLIGHTING
// ============================================================================

// Current match text for highlighting (updated in pgCompletionSource)
let currentMatchText = ''

/**
 * Find the indices of characters to highlight based on match type.
 * Returns an array of indices in the label that should be highlighted.
 */
function getHighlightIndices(label: string, matchText: string): number[] {
  if (!matchText) return []

  const labelLower = label.toLowerCase()
  const matchLower = matchText.toLowerCase()

  // Exact or prefix match: highlight from start
  if (labelLower.startsWith(matchLower)) {
    return Array.from({ length: matchText.length }, (_, i) => i)
  }

  // Contains match: highlight the substring
  const containsIndex = labelLower.indexOf(matchLower)
  if (containsIndex !== -1) {
    return Array.from({ length: matchText.length }, (_, i) => containsIndex + i)
  }

  // Fuzzy match: highlight individual matching characters
  const indices: number[] = []
  let matchIdx = 0
  for (let i = 0; i < label.length && matchIdx < matchText.length; i++) {
    if (labelLower[i] === matchLower[matchIdx]) {
      indices.push(i)
      matchIdx++
    }
  }

  return indices
}

/**
 * Creates a label element with matched characters highlighted in blue.
 */
function createHighlightedLabel(label: string, matchText: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'cm-completionLabel-highlighted'

  const highlightIndices = new Set(getHighlightIndices(label, matchText))

  if (highlightIndices.size === 0) {
    span.textContent = label
    return span
  }

  // Build the label with highlighted portions
  let i = 0
  while (i < label.length) {
    if (highlightIndices.has(i)) {
      // Start a highlight span (styled via CSS)
      const highlightSpan = document.createElement('span')
      highlightSpan.className = 'cm-completionMatchedText'

      // Collect consecutive highlighted characters
      let highlightText = ''
      while (i < label.length && highlightIndices.has(i)) {
        highlightText += label[i]
        i++
      }
      highlightSpan.textContent = highlightText
      span.appendChild(highlightSpan)
    } else {
      // Collect consecutive non-highlighted characters
      let normalText = ''
      while (i < label.length && !highlightIndices.has(i)) {
        normalText += label[i]
        i++
      }
      span.appendChild(document.createTextNode(normalText))
    }
  }

  return span
}

// ============================================================================
// ALIAS EXTRACTION (for on-demand column fetching)
// ============================================================================

/**
 * Simple alias extraction from SQL text.
 * Handles patterns like: "FROM users AS u", "FROM users u", "JOIN orders o"
 */
function extractAliasMap(sql: string): Map<string, string> {
  const aliases = new Map<string, string>()

  // Simple regex-based extraction for common patterns
  // Pattern: table AS alias
  const asPattern = /\b(\w+)\s+AS\s+(\w+)\b/gi
  let match
  while ((match = asPattern.exec(sql)) !== null) {
    aliases.set(match[2].toLowerCase(), match[1])
  }

  // Pattern: FROM/JOIN table alias (without AS)
  const tableAliasPattern = /\b(?:FROM|JOIN)\s+(\w+)\s+(\w+)(?!\s*(?:ON|WHERE|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|JOIN|AS|,|\())|\b(?:FROM|JOIN)\s+(\w+)\.(\w+)\s+(\w+)(?!\s*(?:ON|WHERE|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|JOIN|AS|,|\())/gi
  while ((match = tableAliasPattern.exec(sql)) !== null) {
    if (match[1] && match[2]) {
      // Simple: FROM table alias
      const maybeAlias = match[2].toUpperCase()
      // Skip if it looks like a keyword
      const keywords = ['WHERE', 'ON', 'AND', 'OR', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'JOIN', 'SET', 'VALUES']
      if (!keywords.includes(maybeAlias)) {
        aliases.set(match[2].toLowerCase(), match[1])
      }
    } else if (match[3] && match[4] && match[5]) {
      // Schema-qualified: FROM schema.table alias
      const maybeAlias = match[5].toUpperCase()
      const keywords = ['WHERE', 'ON', 'AND', 'OR', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'JOIN', 'SET', 'VALUES']
      if (!keywords.includes(maybeAlias)) {
        aliases.set(match[5].toLowerCase(), match[4])
      }
    }
  }

  return aliases
}

/**
 * Resolve an alias to its table name using SQL text.
 */
function resolveTableAlias(sql: string, alias: string): string | null {
  const aliases = extractAliasMap(sql)
  return aliases.get(alias.toLowerCase()) || null
}

// ============================================================================
// SCHEMA FETCHING
// ============================================================================

// Fetch columns on-demand and update schemaStore
async function ensureColumns(schema: string, table: string): Promise<void> {
  const connectionId = schemaStore.getConnectionId()
  if (!connectionId) return

  const cached = schemaStore.getColumns(schema, table)
  if (cached) return

  try {
    const response = await rpcClient.getColumns({ connectionId, schema, table })
    schemaStore.setColumns(schema, table, response.columns)
  } catch {
    // Ignore fetch errors
  }
}

// Build SchemaInfo from schemaStore for the modern pipeline
function buildSchema(): SchemaInfo {
  const tables = schemaStore.getTables()
  const functions = schemaStore.getFunctions()
  const selectedTable = schemaStore.getSelectedTable()

  return {
    defaultSchema: schemaStore.getSelectedSchema() || 'public',
    tables: tables.map(t => ({
      schema: t.schema,
      name: t.name,
      type: t.type,
      columns: (schemaStore.getColumns(t.schema, t.name) || []).map(c => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        isPrimaryKey: false,
        isForeignKey: false,
      })),
    })),
    functions: functions.map(f => ({
      schema: f.schema,
      name: f.name,
      signature: f.arguments,
      returnType: f.returnType || '',
      kind: f.kind,
    })),
    selectedTable: selectedTable ? { schema: selectedTable.schema, name: selectedTable.name } : undefined,
  }
}

// ============================================================================
// COMPLETION INFO PANEL
// ============================================================================

/**
 * Creates an info panel for a function completion.
 * Shows: signature line and description.
 */
function createFunctionInfoElement(name: string, source: 'system' | 'schema'): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-function-info'

  let argsString = ''
  let returnType = ''
  let description = ''

  if (source === 'system') {
    const fn = PG_SYSTEM_FUNCTIONS.find(f => f.name === name)
    if (fn?.signatures[0]) {
      argsString = fn.signatures[0].args
      returnType = fn.signatures[0].returnType
    }
    description = fn?.description || ''
  } else {
    const functions = schemaStore.getFunctions()
    const fn = functions.find(f => f.name.toLowerCase() === name.toLowerCase())
    argsString = fn?.arguments || ''
    returnType = fn?.returnType || ''
  }

  // Signature line: name(args) → returnType
  const sigLine = document.createElement('div')
  sigLine.className = 'cm-function-info-signature'

  const nameSpan = document.createElement('span')
  nameSpan.className = 'cm-function-info-name'
  nameSpan.textContent = name
  sigLine.appendChild(nameSpan)

  const argsSpan = document.createElement('span')
  argsSpan.className = 'cm-function-info-args-inline'
  argsSpan.textContent = `(${argsString})`
  sigLine.appendChild(argsSpan)

  if (returnType) {
    const returnSpan = document.createElement('span')
    returnSpan.className = 'cm-function-info-return'
    returnSpan.textContent = ` → ${returnType}`
    sigLine.appendChild(returnSpan)
  }

  container.appendChild(sigLine)

  // Description
  if (description) {
    const descDiv = document.createElement('div')
    descDiv.className = 'cm-function-info-description'
    descDiv.textContent = description
    container.appendChild(descDiv)
  }

  return container
}

// ============================================================================
// TYPE CONVERSION
// ============================================================================

/**
 * Converts a RankedSuggestion from the modern pipeline to a CodeMirror Completion.
 */
function toCompletion(suggestion: RankedSuggestion): Completion {
  const completion: Completion = {
    label: suggestion.value,
    type: CODEMIRROR_TYPE_MAP[suggestion.type] ?? 'keyword',
    detail: suggestion.detail,
    // Use score for boost to maintain ordering
    boost: suggestion.score,
  }

  // For functions and function-like keywords (CAST, COALESCE, etc.),
  // insert "()" and place cursor between parens
  const needsParens = suggestion.type === 'function' ||
    (suggestion.insertText && suggestion.insertText.endsWith('('))

  if (needsParens) {
    completion.apply = (view: EditorView, _completion: Completion, from: number, to: number) => {
      const insertText = suggestion.value + '()'
      view.dispatch({
        changes: { from, to, insert: insertText },
        // Position cursor between the parentheses
        selection: { anchor: from + suggestion.value.length + 1 },
      })
    }
  } else if (suggestion.insertText) {
    // Use insertText if provided for other types
    completion.apply = suggestion.insertText
  }

  // Add info panel for functions
  if (suggestion.type === 'function') {
    const source = suggestion.source === 'system' ? 'system' : 'schema'
    completion.info = () => createFunctionInfoElement(suggestion.value, source)
  }

  return completion
}

// ============================================================================
// RETRIGGER LOGIC
// ============================================================================

/**
 * Wraps a completion to retrigger autocomplete after insertion.
 * Whitespace is NOT injected here — it comes from the pipeline's getInsertText().
 * This only adds the startCompletion() call on top of the original apply behavior.
 */
function wrapWithRetrigger(completion: Completion): Completion {
  const originalApply = completion.apply

  return {
    ...completion,
    apply: (view: EditorView, comp: Completion, from: number, to: number) => {
      // Apply the original completion (string insertText or function)
      if (typeof originalApply === 'function') {
        originalApply(view, comp, from, to)
      } else {
        const text = originalApply ?? completion.label
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
      }
      // Trigger autocomplete after a small delay
      setTimeout(() => startCompletion(view), 10)
    },
  }
}

/**
 * Checks if a completion has insertText ending with a dot (qualifier).
 * Tables in expression contexts insert a dot to trigger column autocomplete.
 */
function hasQualifierDot(completion: Completion): boolean {
  const apply = completion.apply
  if (typeof apply === 'string') {
    return apply.endsWith('.')
  }
  return false
}

/**
 * Wraps completions that should retrigger autocomplete after selection.
 * Only keywords and dot-qualifiers retrigger — tables/columns do not,
 * since the user may want to type `;`, alias, or other non-space characters.
 */
function wrapCompletionsForRetrigger(completions: Completion[], _section: SQLSection): Completion[] {
  return completions.map((c) => {
    // Wrap keywords that are in the retrigger set
    if (c.type === 'keyword' && RETRIGGER_KEYWORDS.has(c.label)) {
      return wrapWithRetrigger(c)
    }
    // Wrap tables/views that insert a dot to retrigger for column autocomplete
    if ((c.type === 'variable' || c.type === 'class') && hasQualifierDot(c)) {
      return wrapWithRetrigger(c)
    }
    return c
  })
}


// ============================================================================
// COMPLETION SOURCE
// ============================================================================

/** Sections where columns should be fetched. */
const COLUMN_FETCH_SECTIONS: Set<SQLSection> = new Set([
  'SELECT_COLUMNS',
  'WHERE_CONDITION',
  'JOIN_CONDITION',
  'GROUP_BY',
  'ORDER_BY',
  'HAVING',
  'UPDATE_SET',
])

/**
 * Main completion source for PostgreSQL autocomplete.
 *
 * Uses a two-phase approach for lazy column loading:
 *
 * Phase 1: Run autocomplete to determine context (SQL section, table prefix).
 *          The schema at this point may not have columns loaded yet.
 *
 * Phase 2: Based on context, fetch columns on-demand from the database.
 *          This updates schemaStore with the newly loaded column data.
 *
 * Phase 3: Re-run autocomplete with the fresh schema that now includes
 *          the just-loaded columns to generate complete suggestions.
 *
 * This pattern avoids loading all columns for all tables upfront, which
 * would be expensive for large databases. Instead, columns are loaded
 * lazily based on what the user is actually typing.
 */
async function pgCompletionSource(ctx: CompletionContext): Promise<CompletionResult | null> {
  const fullSql = ctx.state.doc.toString()
  const cursor = ctx.pos

  // Tokenize and extract just the current statement
  const tokenized = tokenize(fullSql, cursor)
  const { statementSql, statementCursor } = extractCurrentStatement(tokenized, fullSql, cursor)

  // Get the word being typed (or empty for manual trigger)
  const word = ctx.matchBefore(/[\w.]*/)
  if (!word && !ctx.explicit) return null

  // Phase 1: Run autocomplete to determine context (section, table prefix)
  // Schema may be incomplete (missing columns) at this point
  const schema = buildSchema()
  const result = autocomplete(statementSql, statementCursor, schema)
  const { context } = result

  // Phase 2: Fetch columns on-demand based on the detected context
  const tables = schemaStore.getTables()
  const defaultSchema = schemaStore.getSelectedSchema()

  if (context.tablePrefix) {
    // After "table." or "alias." - fetch columns for that specific table
    let tableName = context.tablePrefix
    const resolved = resolveTableAlias(statementSql, tableName)
    if (resolved) {
      tableName = resolved
    }

    const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
    if (table) {
      await ensureColumns(table.schema, table.name)
    }
  } else if (COLUMN_FETCH_SECTIONS.has(context.section)) {
    // In SELECT/WHERE/etc. context - fetch columns for relevant tables
    const selectedTable = schemaStore.getSelectedTable()
    const fetchPromises: Promise<void>[] = []

    // Always load selected table columns first
    if (selectedTable && !schemaStore.getColumns(selectedTable.schema, selectedTable.name)) {
      await ensureColumns(selectedTable.schema, selectedTable.name)
    }

    // Load columns for default schema tables that don't have columns yet
    const defaultSchemaTables = tables.filter(t => t.schema === defaultSchema)
    for (const table of defaultSchemaTables.slice(0, 15)) {
      if (!schemaStore.getColumns(table.schema, table.name)) {
        fetchPromises.push(ensureColumns(table.schema, table.name))
      }
    }

    // Also load columns for other schema tables (limited)
    const otherSchemaTables = tables.filter(t => t.schema !== defaultSchema)
    for (const table of otherSchemaTables.slice(0, 10)) {
      if (!schemaStore.getColumns(table.schema, table.name)) {
        fetchPromises.push(ensureColumns(table.schema, table.name))
      }
    }

    // Wait for column fetches (with timeout to avoid blocking too long)
    if (fetchPromises.length > 0) {
      await Promise.race([
        Promise.all(fetchPromises),
        new Promise(resolve => setTimeout(resolve, 1000)) // 1s timeout
      ])
    }
  }

  // Phase 3: Re-run autocomplete with fresh schema that now includes loaded columns
  const updatedSchema = buildSchema()
  const updatedResult = autocomplete(statementSql, statementCursor, updatedSchema)

  // Don't show autocomplete automatically at statement start (after semicolon)
  // Only show if user is typing something or explicitly requested (Ctrl+Space)
  // This makes behavior consistent with first statement (only shows on type)
  if (updatedResult.context.section === 'STATEMENT_START' &&
      !updatedResult.context.partialToken &&
      !ctx.explicit) {
    return null
  }

  if (updatedResult.suggestions.length === 0) {
    return null
  }

  // Determine what text to match against completions
  // For context with tablePrefix (after "table."): match just the part after the dot
  // For other contexts: match the full text
  const typedText = word?.text || ''
  const dotIndex = typedText.lastIndexOf('.')
  const matchText = context.tablePrefix
    ? (dotIndex >= 0 ? typedText.slice(dotIndex + 1) : typedText).toLowerCase()
    : typedText.toLowerCase()

  // Update module-level match text for highlighting in addToOptions renderer
  currentMatchText = matchText

  // Filter suggestions by match text if present
  let filteredSuggestions = updatedResult.suggestions
  if (matchText) {
    filteredSuggestions = filteredSuggestions
      .filter(s => isMatch(s.value, matchText))
      // Keep original score-based ordering from the pipeline
      .sort((a, b) => b.score - a.score)
  }

  // Convert to CodeMirror completions
  let completions = filteredSuggestions.map(toCompletion)

  // Wrap keywords/tables that should retrigger autocomplete
  completions = wrapCompletionsForRetrigger(completions, updatedResult.context.section)

  // Calculate the correct 'from' position for completion replacement
  // When completing after "table.", we only want to replace the part after the dot
  let from = word?.from ?? cursor
  if (context.tablePrefix && word) {
    const dotIndex = typedText.lastIndexOf('.')
    if (dotIndex >= 0) {
      from = word.from + dotIndex + 1
    }
  }

  return {
    from,
    options: completions,
    filter: false, // We handle filtering ourselves to preserve context-based ordering
    // Note: No validFor - we need the completion source to be re-called on each keystroke
    // since we're doing our own filtering with filter: false
  }
}

// ============================================================================
// EXTENSION
// ============================================================================

export function pgAutocomplete() {
  return [
    autocompletion({
      override: [pgCompletionSource],
      activateOnTyping: true,
      maxRenderedOptions: 50,
      icons: false, // Disable default icons
      addToOptions: [
        {
          // Render custom icon before the label
          render: (completion) => {
            const cmType = completion.type ?? 'keyword'
            const iconType = Object.entries(CODEMIRROR_TYPE_MAP).find(([, v]) => v === cmType)?.[0] as CandidateType | undefined
            return createIconElement(ICON_TYPE_MAP[iconType ?? 'keyword'] ?? 'keyword')
          },
          position: 20,
        },
        {
          // Render highlighted label (replaces default via CSS)
          render: (completion) => {
            return createHighlightedLabel(completion.label, currentMatchText)
          },
          position: 49, // Just before default label at 50
        },
      ],
    }),
  ]
}

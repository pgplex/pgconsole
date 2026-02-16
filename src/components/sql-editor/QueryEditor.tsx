import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { EditorState, StateField, StateEffect, Transaction } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  Decoration,
  type DecorationSet,
  gutter,
  GutterMarker,
  ViewPlugin,
  type ViewUpdate,
  showTooltip,
  type Tooltip,
} from '@codemirror/view'
import { pgHighlight } from './pg-highlight'
import { pgAutocomplete } from './pg-autocomplete'
import { pgSignatureHelp } from './pg-signature-help'
import { pgLinter, type LintFixHandler } from './pg-lint'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { closeBrackets, startCompletion } from '@codemirror/autocomplete'
import { getEditorInfo, type StatementRange, type FoldRegion } from '@/lib/sql'
import { foldKeymap, foldService, foldEffect, unfoldEffect, foldedRanges, codeFolding, foldable, bracketMatching } from '@codemirror/language'
import { RangeSet } from '@codemirror/state'

// Local utility function to find statement at cursor position
function findStatementAt(ranges: StatementRange[], cursor: number): StatementRange | null {
  return ranges.find(r => cursor >= r.from && cursor <= r.to) ?? null
}

export interface QueryEditorHandle {
  getSqlToExecute: () => string
  getSelection: () => { text: string; from: number; to: number } | null
  getContent: () => string
  replaceRange: (from: number, to: number, text: string) => void
  insertAtCursor: (text: string) => void
  getActiveStatementRange: () => Promise<{ from: number; to: number } | null>
  getTooltipPosition: (statementFrom: number) => number
  setErrorLine: (line: number | null) => void
}

export interface CursorPosition {
  line: number
  column: number
  offset: number
  length: number
}

interface QueryEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: (sql: string) => void
  onCursorChange?: (position: CursorPosition) => void
  tabId?: string
  initialFoldedRanges?: string[]
  onFoldChange?: (ranges: string[]) => void
  onRun?: () => void
  onExplain?: () => void
  onFormat?: () => void
  onExplainWithAI?: () => void
  onRewriteWithAI?: () => void
  onFixWithAI?: (errorMessage: string, from: number) => void
  isRewriting?: boolean
  rewritingTooltipPos?: number | null
}

// Effect to update the highlighted range
const setStatementRange = StateEffect.define<{ from: number; to: number } | null>()

// Effect to show/hide rewriting indicator
const setRewritingTooltip = StateEffect.define<{ pos: number } | null>()

// Effect to update fold regions
const setFoldRegions = StateEffect.define<FoldRegion[]>()

// Effect to set/clear error line (1-indexed line number)
const setErrorLineEffect = StateEffect.define<number | null>()

// State field tracking the error line (1-indexed)
const errorLineField = StateField.define<number | null>({
  create() {
    return null
  },
  update(line, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setErrorLineEffect)) {
        return effect.value
      }
    }
    // Clear error on document changes
    if (tr.docChanged) return null
    return line
  },
})

// Error line gutter marker (red dot)
class ErrorLineMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-errorMarker'
    el.textContent = '\u25CF'
    return el
  }
}

const errorMarker = new ErrorLineMarker()

// Gutter that shows error marker — only occupies space when an error line is set
const errorLineGutter = [
  gutter({
    class: 'cm-errorGutter',
    markers: (view) => {
      const line = view.state.field(errorLineField)
      if (line === null || line < 1 || line > view.state.doc.lines) return RangeSet.empty
      const lineObj = view.state.doc.line(line)
      return RangeSet.of([errorMarker.range(lineObj.from)])
    },
  }),
  // Force gutter re-render when error line changes
  ViewPlugin.define((view) => {
    let last = view.state.field(errorLineField)
    return {
      update(update: ViewUpdate) {
        const cur = update.state.field(errorLineField)
        if (cur !== last) {
          last = cur
          update.view.requestMeasure()
        }
      }
    }
  }),
]

// Line decoration for error line background
const errorLineDecoration = Decoration.line({ class: 'cm-error-line' })

const errorLineDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(prev, tr) {
    const line = tr.state.field(errorLineField)
    if (line === null || line < 1 || line > tr.state.doc.lines) {
      return prev === Decoration.none ? prev : Decoration.none
    }
    const lineObj = tr.state.doc.line(line)
    return Decoration.set([errorLineDecoration.range(lineObj.from)])
  },
  provide: (f) => EditorView.decorations.from(f),
})

// Decoration for statement highlight
const statementHighlight = Decoration.mark({
  class: 'cm-active-statement',
})

// State field that tracks the current decoration
const statementHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setStatementRange)) {
        if (effect.value) {
          const docLength = tr.state.doc.length
          // Skip ranges with invalid positions (can happen during edits before re-parse)
          if (effect.value.from < 0 || effect.value.from > docLength || effect.value.to < 0 || effect.value.to > docLength) {
            return Decoration.none
          }
          return Decoration.set([statementHighlight.range(effect.value.from, effect.value.to)])
        }
        return Decoration.none
      }
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f),
})

// State field that stores fold regions
const foldRegionsField = StateField.define<FoldRegion[]>({
  create() {
    return []
  },
  update(regions, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFoldRegions)) {
        return effect.value
      }
    }
    return regions
  },
})

// State field for rewriting indicator position
const rewritingTooltipPosField = StateField.define<number | null>({
  create() {
    return null
  },
  update(pos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setRewritingTooltip)) {
        return effect.value?.pos ?? null
      }
    }
    return pos
  },
})

// Fold service that reads from state field
const sqlFoldService = foldService.of((state, lineStart, lineEnd) => {
  const regions = state.field(foldRegionsField)
  const docLength = state.doc.length

  // Find a fold region that starts on this line
  for (const region of regions) {
    // Skip regions with invalid positions (can happen during edits before re-parse)
    if (region.from < 0 || region.from > docLength || region.to < 0 || region.to > docLength) {
      continue
    }

    const regionLineStart = state.doc.lineAt(region.from).from
    if (regionLineStart === lineStart && region.to > lineEnd) {
      // Return fold range: from end of first line to end of content before next clause
      const firstLineEnd = state.doc.lineAt(region.from).to

      // Adjust fold end to not consume the newline before the next clause
      const endLine = state.doc.lineAt(region.to)
      let foldTo = region.to
      if (endLine.from === region.to && endLine.number > 1) {
        // region.to is at start of a line, fold up to end of previous line
        const prevLine = state.doc.line(endLine.number - 1)
        foldTo = prevLine.to
      }

      return { from: firstLineEnd, to: foldTo }
    }
  }
  return null
})

// Custom fold marker
class FoldMarker extends GutterMarker {
  open: boolean
  constructor(open: boolean) {
    super()
    this.open = open
  }
  toDOM() {
    const marker = document.createElement('span')
    marker.className = 'cm-foldMarker'
    marker.textContent = this.open ? '▼' : '▶'
    return marker
  }
}

const openMarker = new FoldMarker(true)
const closedMarker = new FoldMarker(false)

// Custom fold gutter that watches foldRegionsField
const sqlFoldGutter = [
  codeFolding(),
  gutter({
    class: 'cm-foldGutter',
    markers: (view) => {
      const builder: { from: number; marker: GutterMarker }[] = []
      const regions = view.state.field(foldRegionsField)
      const folded = foldedRanges(view.state)
      const docLength = view.state.doc.length

      for (const region of regions) {
        // Skip regions with invalid positions (can happen during edits before re-parse)
        if (region.from < 0 || region.from > docLength || region.to < 0 || region.to > docLength) {
          continue
        }

        const line = view.state.doc.lineAt(region.from)
        // Check if this region spans multiple lines
        const endLine = view.state.doc.lineAt(region.to)
        if (line.number >= endLine.number) continue

        // Check if already folded
        let isFolded = false
        const foldRange = foldable(view.state, line.from, line.to)
        if (foldRange) {
          folded.between(foldRange.from, foldRange.to, () => { isFolded = true })
        }

        builder.push({ from: line.from, marker: isFolded ? closedMarker : openMarker })
      }

      return RangeSet.of(builder.map(b => b.marker.range(b.from)), true)
    },
    initialSpacer: () => openMarker,
    domEventHandlers: {
      click: (view, line) => {
        // First check if there's already a folded range starting on this line
        const folded = foldedRanges(view.state)
        let existingFold: { from: number; to: number } | null = null
        folded.between(line.from, line.to, (from, to) => {
          if (view.state.doc.lineAt(from).from === line.from) {
            existingFold = { from, to }
          }
        })

        if (existingFold) {
          // Unfold existing fold
          view.dispatch({
            effects: unfoldEffect.of(existingFold)
          })
          return true
        }

        // Otherwise try to fold
        const foldRange = foldable(view.state, line.from, line.to)
        if (foldRange) {
          view.dispatch({
            effects: foldEffect.of({ from: foldRange.from, to: foldRange.to })
          })
          return true
        }
        return false
      }
    }
  }),
  // ViewPlugin to force gutter update when fold regions change
  ViewPlugin.define((view) => {
    let lastRegions = view.state.field(foldRegionsField)
    return {
      update(update: ViewUpdate) {
        const newRegions = update.state.field(foldRegionsField)
        if (newRegions !== lastRegions) {
          lastRegions = newRegions
          // Force gutter to re-render by requesting a measure
          view.requestMeasure()
        }
      }
    }
  })
]

// Function to create rewriting indicator tooltip
function createRewritingTooltipGlobal(): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-rewriting-indicator'
  container.innerHTML = `
    <div class="flex gap-1">
      <span class="size-2 rounded-full bg-blue-400 animate-bounce"></span>
      <span class="size-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay: 0.1s"></span>
      <span class="size-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay: 0.2s"></span>
    </div>
    <span>Rewriting with AI...</span>
  `
  return container
}

// State field for rewriting indicator tooltip
const rewritingTooltipField = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(_, tr) {
    const pos = tr.state.field(rewritingTooltipPosField)
    if (pos === null) return []

    return [{
      pos,
      above: true,
      strictSide: true,
      arrow: false,
      create: () => ({ dom: createRewritingTooltipGlobal() }),
    }]
  },
  provide: f => showTooltip.computeN([f], state => state.field(f)),
})

export const QueryEditor = forwardRef<QueryEditorHandle, QueryEditorProps>(function QueryEditor(
  { value, onChange, onExecute, onCursorChange, initialFoldedRanges, onFoldChange, onRun, onExplain, onFormat, onExplainWithAI, onRewriteWithAI, onFixWithAI, isRewriting, rewritingTooltipPos },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const rangesRef = useRef<StatementRange[]>([])
  const currentStatementRef = useRef<StatementRange | null>(null)
  const parseTimeoutRef = useRef<number | undefined>(undefined)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const updateStatementHighlight = (view: EditorView) => {
    const cursor = view.state.selection.main.head
    const statement = findStatementAt(rangesRef.current, cursor)
    currentStatementRef.current = statement

    view.dispatch({
      effects: setStatementRange.of(statement),
    })
  }

  const getSqlToExecute = (): string => {
    const view = viewRef.current
    if (!view) return value

    const selected = view.state.sliceDoc(
      view.state.selection.main.from,
      view.state.selection.main.to
    )
    if (selected.trim()) return selected

    // Use cached statement
    if (currentStatementRef.current) {
      return view.state.sliceDoc(currentStatementRef.current.from, currentStatementRef.current.to)
    }

    return view.state.doc.toString()
  }

  const getSelection = (): { text: string; from: number; to: number } | null => {
    const view = viewRef.current
    if (!view) return null

    const { from, to } = view.state.selection.main
    if (from === to) return null

    return {
      text: view.state.sliceDoc(from, to),
      from,
      to,
    }
  }

  const getContent = (): string => {
    return viewRef.current?.state.doc.toString() ?? value
  }

  const replaceRange = (from: number, to: number, text: string): void => {
    viewRef.current?.dispatch({
      changes: { from, to, insert: text },
      annotations: Transaction.userEvent.of('input'),
    })
  }

  const insertAtCursor = (text: string): void => {
    const view = viewRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
    view.focus()
  }

  const getActiveStatementRange = async (): Promise<{ from: number; to: number } | null> => {
    const view = viewRef.current
    if (!view) return null

    // Force immediate parse to get up-to-date statement ranges
    const text = view.state.doc.toString()
    const cursor = view.state.selection.main.head
    const result = await getEditorInfo(text)

    // Find statement at cursor
    const statement = findStatementAt(result.statementRanges, cursor)
    return statement
  }

  const getTooltipPosition = (statementFrom: number): number => {
    const view = viewRef.current
    if (!view) return statementFrom

    // Get the line where the statement starts
    const statementLine = view.state.doc.lineAt(statementFrom)

    // Return the beginning of that line
    // The tooltip with above: true will render above this line
    return statementLine.from
  }

  const setErrorLine = (line: number | null) => {
    viewRef.current?.dispatch({
      effects: setErrorLineEffect.of(line),
    })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  useImperativeHandle(ref, () => ({
    getSqlToExecute,
    getSelection,
    getContent,
    replaceRange,
    insertAtCursor,
    getActiveStatementRange,
    getTooltipPosition,
    setErrorLine,
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const executeKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        run: (view) => {
          const selected = view.state.sliceDoc(
            view.state.selection.main.from,
            view.state.selection.main.to
          )
          let sqlToExecute: string
          if (selected.trim()) {
            sqlToExecute = selected
          } else if (currentStatementRef.current) {
            sqlToExecute = view.state.sliceDoc(
              currentStatementRef.current.from,
              currentStatementRef.current.to
            )
          } else {
            sqlToExecute = view.state.doc.toString()
          }
          onExecute(sqlToExecute)
          return true
        },
      },
    ])

    const fixHandler: LintFixHandler | undefined = onFixWithAI ? { onFixWithAI } : undefined

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        lineNumbers(),
        highlightActiveLineGutter(),
        errorLineField,
        errorLineDecorationField,
        errorLineGutter,
        statementHighlightField,
        foldRegionsField,
        rewritingTooltipPosField,
        rewritingTooltipField,
        pgHighlight(),
        pgAutocomplete(),
        pgSignatureHelp(),
        pgLinter(fixHandler),
        bracketMatching(),
        closeBrackets(),
        sqlFoldService,
        sqlFoldGutter,
        executeKeymap,
        keymap.of([
          { key: 'Ctrl-Space', run: startCompletion },
          { key: 'Alt-Escape', run: startCompletion },
          ...foldKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())

            // Debounced parse
            clearTimeout(parseTimeoutRef.current)
            parseTimeoutRef.current = window.setTimeout(async () => {
              const view = viewRef.current
              if (!view) return
              const text = view.state.doc.toString()
              try {
                const result = await getEditorInfo(text)
                // Check if document changed while parsing (result is stale)
                if (view.state.doc.toString() !== text) return
                rangesRef.current = result.statementRanges
                view.dispatch({
                  effects: setFoldRegions.of(result.foldRegions)
                })
                // Force fold gutter to rebuild markers
                view.requestMeasure()
                updateStatementHighlight(view)
              } catch {
                // Ignore parse errors
              }
            }, 150)
          }
          if (update.selectionSet) {
            updateStatementHighlight(update.view)
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head
            const line = update.state.doc.lineAt(pos)
            onCursorChange?.({
              line: line.number,
              column: pos - line.from + 1,
              offset: pos,
              length: update.state.doc.length,
            })
          }
          // Track fold changes
          if (update.transactions.some(tr => tr.effects.some(e => e.is(foldEffect) || e.is(unfoldEffect)))) {
            if (onFoldChange) {
              const folded: string[] = []
              foldedRanges(update.state).between(0, update.state.doc.length, (from, to) => {
                folded.push(`${from}:${to}`)
              })
              onFoldChange(folded)
            }
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': {
            padding: '8px 0',
          },
          '.cm-line': {
            padding: '0 8px',
          },
          '.cm-active-statement': {
            backgroundColor: 'rgba(59, 130, 246, 0.065)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(59, 130, 246, 0.075)',
          },
          '.cm-error-line': {
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
          },
          '.cm-errorGutter .cm-gutterElement': {
            padding: '0 2px',
          },
          '.cm-errorMarker': {
            color: '#ef4444',
            fontSize: '8px',
          },
          '.cm-foldPlaceholder': {
            backgroundColor: 'rgba(59, 130, 246, 0.075)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '3px',
            padding: '0 4px',
            margin: '0 2px',
            cursor: 'pointer',
          },
          '.cm-foldGutter': {
            width: '14px',
          },
          '.cm-foldGutter .cm-gutterElement': {
            cursor: 'pointer',
            color: 'rgba(100, 100, 100, 0.5)',
            fontSize: '10px',
            lineHeight: '1.4',
            transition: 'color 0.15s',
          },
          '.cm-foldGutter .cm-gutterElement:hover': {
            color: 'rgba(59, 130, 246, 0.8)',
          },
          '.cm-rewriting-indicator': {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            color: '#4b5563',
            pointerEvents: 'none',
          },
          '.cm-diagnosticAction': {
            marginTop: '6px',
            padding: '0',
            backgroundColor: 'transparent',
            color: '#3b82f6',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
          },
          '.cm-diagnosticAction:hover': {
            textDecoration: 'underline',
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    // Restore fold state if provided
    if (initialFoldedRanges && initialFoldedRanges.length > 0) {
      const effects = initialFoldedRanges.map(key => {
        const [from, to] = key.split(':').map(Number)
        return foldEffect.of({ from, to })
      })
      view.dispatch({ effects })
    }

    // Parse immediately on mount
    getEditorInfo(value).then((result) => {
      // View may have been destroyed by the time parse completes
      if (!viewRef.current) return
      rangesRef.current = result.statementRanges
      view.dispatch({
        effects: setFoldRegions.of(result.foldRegions)
      })
      // Force fold gutter to rebuild markers
      view.requestMeasure()
      updateStatementHighlight(view)
    }).catch(() => {})

    return () => {
      clearTimeout(parseTimeoutRef.current)
      view.destroy()
    }
  }, []) // Only run once on mount

  // Update content when value changes externally
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentContent = view.state.doc.toString()
    if (currentContent !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      })
    }
  }, [value])

  // Update rewriting indicator visibility using tooltip
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (isRewriting && rewritingTooltipPos !== null && rewritingTooltipPos !== undefined) {
      // Show rewriting indicator tooltip at cursor position
      view.dispatch({
        effects: setRewritingTooltip.of({ pos: rewritingTooltipPos })
      })
    } else {
      // Hide indicator
      view.dispatch({
        effects: setRewritingTooltip.of(null)
      })
    }
  }, [isRewriting, rewritingTooltipPos])

  return (
    <>
      <div ref={containerRef} className="h-full" onContextMenu={handleContextMenu} />
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeContextMenu()
            }}
          />
          <div
            className="fixed z-50 min-w-32 rounded-lg border bg-popover shadow-lg p-1"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            {(onExplainWithAI || onRewriteWithAI) && (
              <>
                {onExplainWithAI && (
                  <div
                    className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onExplainWithAI()
                      closeContextMenu()
                    }}
                  >
                    Explain with AI
                  </div>
                )}
                {onRewriteWithAI && (
                  <div
                    className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onRewriteWithAI()
                      closeContextMenu()
                    }}
                  >
                    Rewrite with AI
                  </div>
                )}
                <div className="mx-2 my-1 h-px bg-border" />
              </>
            )}
            {onRun && (
              <div
                className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onRun()
                  closeContextMenu()
                }}
              >
                Run
              </div>
            )}
            {onExplain && (
              <div
                className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onExplain()
                  closeContextMenu()
                }}
              >
                Explain
              </div>
            )}
            {onFormat && (
              <div
                className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onFormat()
                  closeContextMenu()
                }}
              >
                Format
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
})

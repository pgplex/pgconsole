import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Play, X, Sparkles, Clipboard, Check } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { Button } from '@/components/ui/button'
import { toastManager } from '@/components/ui/toast'
import { Tooltip, TooltipTrigger, TooltipPopup } from '@/components/ui/tooltip'
import { pgHighlight } from './pg-highlight'
import { useSqlModuleReady, editorTheme } from './schema/shared'
import type { StagedChange } from '@/lib/staged-changes'
import { generateDeleteSQL, generateUpdateSQL, generateInsertSQL } from '@/lib/staged-changes'
import { RiskAssessmentModal } from './RiskAssessmentModal'
import { formatSql } from '@/lib/sql/format'

function generateSQL(change: StagedChange): string {
  if (change.type === 'delete') {
    return generateDeleteSQL(change)
  } else if (change.type === 'update') {
    return generateUpdateSQL(change)
  } else if (change.type === 'insert') {
    return generateInsertSQL(change)
  }
  return ''
}

interface StagedChangesModalProps {
  open: boolean
  onClose: () => void
  connectionId: string
  stagedChanges: StagedChange[]
  onExecuteAll: () => Promise<void>
}

const AI_STORAGE_KEY = 'pgconsole-ai'

interface PersistedAISettings {
  byConnection: Record<string, { provider: string }>
}

function getAIProvider(connectionId: string): string | null {
  try {
    const stored = localStorage.getItem(AI_STORAGE_KEY)
    if (!stored) return null
    const settings: PersistedAISettings = JSON.parse(stored)
    return settings.byConnection[connectionId]?.provider || null
  } catch {
    return null
  }
}

function SQLPreview({ sql }: { sql: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const moduleReady = useSqlModuleReady()

  useEffect(() => {
    if (!containerRef.current || !moduleReady) return

    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const state = EditorState.create({
      doc: sql,
      extensions: [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        lineNumbers(),
        pgHighlight(),
        editorTheme(),
      ],
    })

    viewRef.current = new EditorView({ state, parent: containerRef.current })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [sql, moduleReady])

  return (
    <div
      ref={containerRef}
      className="h-full bg-gray-50 rounded-md overflow-hidden border border-gray-200"
    />
  )
}

export function StagedChangesModal({
  open,
  onClose,
  connectionId,
  stagedChanges,
  onExecuteAll,
}: StagedChangesModalProps) {
  const [executingAll, setExecutingAll] = useState(false)
  const [riskModalOpen, setRiskModalOpen] = useState(false)
  const [aiProviderId, setAiProviderId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect AI provider on mount
  useEffect(() => {
    const provider = getAIProvider(connectionId)
    setAiProviderId(provider)
  }, [connectionId])

  // Auto-close when no staged changes remain
  useEffect(() => {
    if (open && stagedChanges.length === 0) {
      onClose()
    }
  }, [open, stagedChanges.length, onClose])

  // Combine all SQL statements from all staged changes, separated by newlines
  const allSQL = useMemo(() => {
    return stagedChanges
      .map((change) => generateSQL(change))
      .filter(sql => sql)
      .join('\n\n')
  }, [stagedChanges])

  // Format SQL for display
  const [formattedSQL, setFormattedSQL] = useState('')

  useEffect(() => {
    async function formatAllSQL() {
      if (!allSQL) {
        setFormattedSQL('')
        return
      }

      try {
        const formatted = await formatSql(allSQL)
        setFormattedSQL(formatted)
      } catch {
        // If formatting fails, fall back to unformatted SQL
        setFormattedSQL(allSQL)
      }
    }

    formatAllSQL()
  }, [allSQL])

  // Count total SQL statements
  const statementCount = useMemo(() => {
    return stagedChanges.reduce((count, change) => {
      const sql = generateSQL(change)
      // Count statements by counting semicolons (each statement ends with ;)
      return count + (sql.match(/;/g) || []).length
    }, 0)
  }, [stagedChanges])

  const handleExecuteAll = useCallback(async () => {
    setExecutingAll(true)
    try {
      await onExecuteAll()
      toastManager.add({ type: 'success', title: 'All changes executed successfully' })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: 'Failed to execute changes',
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setExecutingAll(false)
    }
  }, [onExecuteAll])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(formattedSQL || allSQL)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [formattedSQL, allSQL])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-5xl rounded-2xl border bg-white shadow-lg flex flex-col h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DialogPrimitive.Title className="text-lg font-semibold">
                  Preview Changes ({statementCount} {statementCount === 1 ? 'statement' : 'statements'})
                </DialogPrimitive.Title>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopy}
                      disabled={stagedChanges.length === 0}
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Clipboard className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipPopup>{copied ? 'Copied!' : 'Copy all statements'}</TooltipPopup>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                {aiProviderId ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRiskModalOpen(true)}
                    disabled={stagedChanges.length === 0}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Assess Risk
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <span>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Assess Risk
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipPopup>
                      Configure an AI provider in Settings to enable risk assessment
                    </TooltipPopup>
                  </Tooltip>
                )}
                <Button
                  size="sm"
                  onClick={handleExecuteAll}
                  disabled={executingAll || stagedChanges.length === 0}
                >
                  <Play className="w-4 h-4 mr-1" />
                  {executingAll ? 'Executing...' : 'Execute All'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  disabled={executingAll}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4">
              {stagedChanges.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No staged changes
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-auto">
                  <SQLPreview sql={formattedSQL} />
                </div>
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>

      {/* Risk Assessment Modal */}
      {riskModalOpen && aiProviderId && (
        <RiskAssessmentModal
          open={riskModalOpen}
          onClose={() => setRiskModalOpen(false)}
          connectionId={connectionId}
          providerId={aiProviderId}
          sqlStatements={stagedChanges.map(change => generateSQL(change))}
        />
      )}
    </DialogPrimitive.Root>
  )
}

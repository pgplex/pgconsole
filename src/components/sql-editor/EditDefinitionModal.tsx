import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { Button } from '../ui/button'
import { FileDiff } from '@pierre/diffs/react'
import { parseDiffFromFile } from '@pierre/diffs'
import type { FileContents } from '@pierre/diffs'
import { pgHighlight } from './pg-highlight'
import { useSqlModuleReady, editorTheme } from './schema/shared'

interface EditDefinitionModalProps {
  open: boolean
  onClose: () => void
  onApply: (sql: string) => void
  original: string
  objectType?: 'function' | 'procedure'
  isApplying?: boolean
  applyError?: string | null
}

export function EditDefinitionModal({
  open,
  onClose,
  onApply,
  original,
  objectType = 'function',
  isApplying = false,
  applyError = null,
}: EditDefinitionModalProps) {
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [editedSql, setEditedSql] = useState(original)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editedSqlRef = useRef(editedSql)
  const moduleReady = useSqlModuleReady()

  // Keep ref in sync with state
  editedSqlRef.current = editedSql

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('edit')
      setEditedSql(original)
      editedSqlRef.current = original
    }
  }, [open, original])

  // Create editor when in edit step and container is mounted
  useEffect(() => {
    if (!open || step !== 'edit' || !containerEl || !moduleReady) return

    viewRef.current?.destroy()

    const state = EditorState.create({
      doc: editedSqlRef.current || original,
      extensions: [
        EditorView.editable.of(true),
        lineNumbers(),
        pgHighlight(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newSql = update.state.doc.toString()
            setEditedSql(newSql)
            editedSqlRef.current = newSql
          }
        }),
        editorTheme(true),
      ],
    })

    viewRef.current = new EditorView({ state, parent: containerEl })
    viewRef.current.focus()

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [open, step, moduleReady, original, containerEl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute diff for preview step
  const diffData = useMemo(() => {
    if (step !== 'preview') return null
    const oldFile: FileContents = { name: 'original', contents: original, lang: 'sql' }
    const newFile: FileContents = { name: 'modified', contents: editedSql, lang: 'sql' }
    return parseDiffFromFile(oldFile, newFile)
  }, [step, original, editedSql])

  const hasChanges = editedSql !== original
  const hasDiffChanges = diffData ? diffData.hunks.length > 0 : false
  const editStepLabel = objectType === 'procedure' ? 'Edit procedure' : 'Edit function'

  // Callback ref to track container mount
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainerEl(node), [])

  const handleClose = () => !isApplying && onClose()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-4xl rounded-2xl border bg-white shadow-lg flex flex-col h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-2 border-b border-gray-100">
              <DialogPrimitive.Title className="flex items-center gap-1 text-sm text-gray-500">
                <span className={step === 'edit' ? 'text-gray-900 font-medium' : ''}>
                  1. {editStepLabel}
                </span>
                <ChevronRight className="w-4 h-4" />
                <span className={step === 'preview' ? 'text-gray-900 font-medium' : ''}>
                  2. Preview
                </span>
              </DialogPrimitive.Title>
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-hidden min-h-0">
              {step === 'edit' ? (
                <div
                  ref={containerRef}
                  className="h-full bg-white rounded-lg border border-blue-300 ring-1 ring-blue-100 overflow-auto"
                />
              ) : (
                <div className="h-full overflow-auto">
                  {hasDiffChanges && diffData ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden h-full">
                      <FileDiff
                        fileDiff={diffData}
                        options={{
                          diffStyle: 'split',
                          theme: 'github-light',
                          disableFileHeader: true,
                          overflow: 'scroll',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No changes detected
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 p-4 pt-2 border-t border-gray-100">
              {applyError && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {applyError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  {step === 'preview' && (
                    <Button variant="outline" size="sm" onClick={() => setStep('edit')} disabled={isApplying}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back to Edit
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleClose} disabled={isApplying}>
                    Cancel
                  </Button>
                  {step === 'edit' ? (
                    <Button size="sm" onClick={() => setStep('preview')} disabled={!hasChanges}>
                      Preview Changes
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onApply(editedSql)} disabled={!hasDiffChanges || isApplying}>
                      {isApplying ? 'Applying...' : 'Apply Changes'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

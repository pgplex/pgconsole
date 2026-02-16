import { Copy, Check, X } from 'lucide-react'
import { useState, useCallback, useMemo, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '../ui/button'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    backgroundColor: 'transparent',
    height: '100%',
  },
  '.cm-content': {
    padding: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
})

interface JsonExpandModalProps {
  open: boolean
  onClose: () => void
  value: unknown
  columnName: string
  onSave?: (newValue: string) => void
}

export function JsonExpandModal({ open, onClose, value, columnName, onSave }: JsonExpandModalProps) {
  const [copied, setCopied] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const viewRef = useRef<EditorView | null>(null)

  const initialValue = useMemo(() => {
    if (value === null || value === undefined) return ''
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  const initEditor = useCallback((container: HTMLDivElement | null) => {
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }
    if (!container) return

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        json(),
        syntaxHighlighting(defaultHighlightStyle),
        editorTheme,
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setHasChanges(update.state.doc.toString() !== initialValue)
          }
        }),
      ],
    })

    viewRef.current = new EditorView({ state, parent: container })
    requestAnimationFrame(() => viewRef.current?.focus())
  }, [initialValue])

  const handleCopy = useCallback(async () => {
    const text = viewRef.current?.state.doc.toString() ?? initialValue
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [initialValue])

  const handleSave = useCallback(() => {
    if (onSave && viewRef.current) {
      onSave(viewRef.current.state.doc.toString())
      onClose()
    }
  }, [onSave, onClose])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-2xl rounded-2xl border bg-white shadow-lg">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <DialogPrimitive.Title className="text-base font-medium">{columnName}</DialogPrimitive.Title>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4">
              <div
                ref={initEditor}
                className="bg-gray-50 border border-gray-200 rounded-lg h-[60vh] overflow-auto"
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={!hasChanges}>
                Save
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

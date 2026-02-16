import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '../ui/button'
import { FileDiff } from '@pierre/diffs/react'
import { parseDiffFromFile } from '@pierre/diffs'
import type { FileContents } from '@pierre/diffs'

interface DiffPreviewModalProps {
  open: boolean
  onClose: () => void
  onApply: () => void
  original: string
  modified: string
  title?: string
}

export function DiffPreviewModal({
  open,
  onClose,
  onApply,
  original,
  modified,
  title = 'Review Changes',
}: DiffPreviewModalProps) {
  // Handle ESC key
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Create diff metadata
  const fileDiff = useMemo(() => {
    const oldFile: FileContents = {
      name: 'original',
      contents: original,
      lang: 'sql',
    }
    const newFile: FileContents = {
      name: 'modified',
      contents: modified,
      lang: 'sql',
    }
    return parseDiffFromFile(oldFile, newFile)
  }, [original, modified])

  // Check if there are actual changes
  const hasChanges = fileDiff.hunks.length > 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-4xl rounded-2xl border bg-white shadow-lg">
            <div className="flex items-center justify-between p-4 pb-2">
              <DialogPrimitive.Title className="text-base font-medium">{title}</DialogPrimitive.Title>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 px-2"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onApply}
                  disabled={!hasChanges}
                  className="h-8"
                >
                  Apply Changes
                </Button>
              </div>
            </div>
            <div className="px-4 pb-4">
              {hasChanges ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden max-h-[60vh] overflow-auto">
                  <FileDiff
                    fileDiff={fileDiff}
                    options={{
                      diffStyle: 'split',
                      theme: 'github-light',
                      disableFileHeader: true,
                      overflow: 'scroll',
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No changes detected
                </div>
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

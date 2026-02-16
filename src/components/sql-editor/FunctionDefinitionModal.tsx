import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { SQLDefinition } from './schema/shared'

interface FunctionDefinitionModalProps {
  open: boolean
  onClose: () => void
  name: string
  schema: string
  definition: string
}

export function FunctionDefinitionModal({ open, onClose, name, schema, definition }: FunctionDefinitionModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-4xl rounded-2xl border bg-white shadow-lg">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <DialogPrimitive.Title className="text-base font-medium">{name}</DialogPrimitive.Title>
                <Badge variant="muted">{schema}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-4 pb-4 max-h-[70vh] overflow-auto">
              <SQLDefinition sql={definition} />
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

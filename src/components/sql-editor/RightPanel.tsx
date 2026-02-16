import { cn } from '@/lib/utils'
import { Chat } from './Chat'
import { ContextPanel } from './ContextPanel'
import type { SelectedObject } from './SQLEditorLayout'
import type { PanelTab } from './hooks/useEditorTabs'
import type { ObjectType } from './ObjectTree'

interface RightPanelProps {
  open: boolean
  width: number
  activeTab: PanelTab
  onActiveTabChange: (tab: PanelTab) => void
  connectionId: string
  selectedObject: SelectedObject | null
  onInsertSQL: (sql: string) => void
  onRunSQL: (sql: string) => void
  onViewSchema: (schema: string, name: string, objectType: ObjectType, args?: string) => void
  selectedSchema?: string
  initialPrompt?: { sql: string; action: 'explain' } | null
  onInitialPromptProcessed?: () => void
}

export function RightPanel({ open, width, activeTab, onActiveTabChange, connectionId, selectedObject, onInsertSQL, onRunSQL, onViewSchema, selectedSchema, initialPrompt, onInitialPromptProcessed }: RightPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div style={{ width }} className="flex-shrink-0 flex flex-col">
      <div className="h-8 px-2 flex items-center justify-center border-b border-gray-200 bg-gray-50">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onActiveTabChange('context')}
            className={cn(
              "px-3 py-1 text-xs font-medium",
              activeTab === 'context'
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Context
          </button>
          <button
            type="button"
            onClick={() => onActiveTabChange('chat')}
            className={cn(
              "px-3 py-1 text-xs font-medium",
              activeTab === 'chat'
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chat
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'context' ? (
          <ContextPanel connectionId={connectionId} selectedObject={selectedObject} onViewSchema={onViewSchema} />
        ) : (
          <Chat connectionId={connectionId} onInsertSQL={onInsertSQL} onRunSQL={onRunSQL} selectedSchema={selectedSchema} initialPrompt={initialPrompt} onInitialPromptProcessed={onInitialPromptProcessed} />
        )}
      </div>
    </div>
  )
}

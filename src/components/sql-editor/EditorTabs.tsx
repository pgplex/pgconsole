import { X, FileCode, Grid3x3, Eye, Layers, FunctionSquare, Code, PanelRight } from 'lucide-react'
import { useRef, useCallback, useState } from 'react'
import { Button } from '../ui/button'
import { Menu, MenuPopup, MenuItem, MenuSeparator } from '../ui/menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { cn } from '@/lib/utils'
import type { TabState, SchemaTab } from './hooks/useEditorTabs'
import type { ObjectType } from './ObjectTree'

function getSchemaTabIcon(objectType: ObjectType | undefined) {
  switch (objectType) {
    case 'view':
      return Eye
    case 'materialized_view':
      return Layers
    case 'function':
      return FunctionSquare
    case 'procedure':
      return Code
    case 'table':
    default:
      return Grid3x3
  }
}

interface EditorTabsProps {
  tabs: TabState[]
  activeTabId: string
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
  onCloseOthers: (id: string) => void
  onCloseToRight: (id: string) => void
  onCloseAll: () => void
  rightPanelOpen?: boolean
  onRightPanelToggle?: () => void
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  rightPanelOpen,
  onRightPanelToggle,
}: EditorTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)

  // Handle horizontal scrolling with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault()
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ tabId, x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const tabIndex = contextMenu ? tabs.findIndex(t => t.tab.id === contextMenu.tabId) : -1
  const isLastTab = tabIndex === tabs.length - 1

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="flex items-center flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300"
        onWheel={handleWheel}
      >
        {tabs.map(({ tab }) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger
              render={
                <div
                  className={cn(
                    'group flex items-center gap-1 h-8 px-3 border-r border-gray-200 cursor-pointer text-sm shrink min-w-0',
                    activeTabId === tab.id
                      ? 'bg-white text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  style={{ minWidth: '80px', maxWidth: '160px' }}
                  onClick={() => onTabSelect(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      onTabClose(tab.id)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, tab.id)}
                >
                  {tab.type === 'schema' ? (
                    (() => {
                      const Icon = getSchemaTabIcon((tab as SchemaTab).objectType)
                      return <Icon className="size-3.5 shrink-0 text-gray-500" />
                    })()
                  ) : (
                    <FileCode className="size-3.5 shrink-0 text-gray-500" />
                  )}
                  <span className="truncate flex-1">{tab.name}</span>
                  <Button
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 shrink-0 !size-4 !min-h-0 !p-0 !rounded-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTabClose(tab.id)
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              }
            />
            <TooltipContent side="bottom">{tab.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {onRightPanelToggle && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={rightPanelOpen ? "secondary" : "ghost"}
                size="icon-sm"
                className="shrink-0 mx-1"
                onClick={onRightPanelToggle}
              >
                <PanelRight className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {rightPanelOpen ? 'Hide panel' : 'Show panel'}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Context Menu */}
      <Menu open={contextMenu !== null} onOpenChange={(open) => !open && closeContextMenu()}>
        <MenuPopup
          className="whitespace-nowrap"
          style={{
            position: 'fixed',
            left: contextMenu?.x ?? 0,
            top: contextMenu?.y ?? 0,
          }}
          side="bottom"
          align="start"
          sideOffset={0}
        >
          <MenuItem
            onClick={() => {
              if (contextMenu) onTabClose(contextMenu.tabId)
              closeContextMenu()
            }}
          >
            Close
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (contextMenu) onCloseOthers(contextMenu.tabId)
              closeContextMenu()
            }}
            disabled={tabs.length <= 1}
          >
            Close Others
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (contextMenu) onCloseToRight(contextMenu.tabId)
              closeContextMenu()
            }}
            disabled={isLastTab}
          >
            Close to the Right
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onClick={() => {
              onCloseAll()
              closeContextMenu()
            }}
          >
            Close All
          </MenuItem>
        </MenuPopup>
      </Menu>
    </>
  )
}

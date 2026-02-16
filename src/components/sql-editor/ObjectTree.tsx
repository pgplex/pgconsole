import { useState, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Grid3x3, Eye, Info, Layers, FunctionSquare, Code } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible'
import { ScrollArea } from '../ui/scroll-area'
import { ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Badge } from '../ui/badge'
import { cn } from '@/lib/utils'
import type { SelectedObject } from './SQLEditorLayout'

interface NamedObject {
  name: string
  arguments?: string // For functions/procedures to handle overloading
}

export type ObjectType = 'table' | 'view' | 'materialized_view' | 'function' | 'procedure'

interface ObjectTreeProps {
  tables: NamedObject[]
  views: NamedObject[]
  materializedViews: NamedObject[]
  functions: NamedObject[]
  procedures: NamedObject[]
  searchQuery: string
  selectedObject: SelectedObject | null
  onObjectSelect: (obj: SelectedObject | null) => void
  onObjectDoubleClick: (schema: string, objectName: string, objectType: ObjectType, args?: string) => void
  onViewSchema: (schema: string, objectName: string, objectType: ObjectType, args?: string) => void
  onGenerateSQL?: (schema: string, objectName: string, objectType: ObjectType, sqlType: 'select' | 'insert' | 'update' | 'delete' | 'create_table' | 'alter_add_column') => void
  schema: string
  connectionId: string
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 text-inherit">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

type ObjectSectionProps = Omit<ObjectTreeProps, 'tables' | 'views' | 'materializedViews' | 'functions' | 'procedures' | 'connectionId'> & {
  title: string
  icon: LucideIcon
  objects: NamedObject[]
  objectType: ObjectType
}

function ObjectSection({ title, icon: Icon, objects, searchQuery, selectedObject, onObjectSelect, onObjectDoubleClick, onViewSchema, onGenerateSQL, schema, objectType }: ObjectSectionProps) {
  const [sectionOpen, setSectionOpen] = useState(true)

  const filteredObjects = objects.filter((obj) =>
    obj.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filteredObjects.length === 0 && searchQuery) return null

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen} className="mt-2 first:mt-0">
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 rounded overflow-hidden">
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform',
            sectionOpen && 'rotate-90'
          )}
        />
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{title}</span>
        <Badge variant="secondary" size="sm" className="rounded-full shrink-0 text-[10px] lowercase">{filteredObjects.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 mt-0.5 border-l border-gray-200 pl-1">
          {filteredObjects.map((obj) => {
            // For functions/procedures, include arguments in key and identity for overload support
            const objectKey = obj.arguments !== undefined ? `${obj.name}(${obj.arguments})` : obj.name
            const isSelected = selectedObject?.schema === schema &&
              selectedObject?.name === obj.name &&
              selectedObject?.type === objectType &&
              (obj.arguments === undefined || selectedObject?.arguments === obj.arguments)

            return (
              <ObjectItem
                key={objectKey}
                objectName={obj.name}
                searchQuery={searchQuery}
                isSelected={isSelected}
                onClick={() => {
                  onObjectSelect({ schema, name: obj.name, type: objectType, arguments: obj.arguments })
                }}
                onDoubleClick={() => onObjectDoubleClick(schema, obj.name, objectType, obj.arguments)}
                onViewSchema={() => onViewSchema(schema, obj.name, objectType, obj.arguments)}
                onGenerateSQL={onGenerateSQL ? (sqlType) => onGenerateSQL(schema, obj.name, objectType, sqlType) : undefined}
                objectType={objectType}
              />
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ObjectItem({
  objectName,
  searchQuery,
  isSelected,
  onClick,
  onDoubleClick,
  onViewSchema,
  onGenerateSQL,
  objectType,
}: {
  objectName: string
  searchQuery: string
  isSelected: boolean
  onClick: () => void
  onDoubleClick: () => void
  onViewSchema: () => void
  onGenerateSQL?: (sqlType: 'select' | 'insert' | 'update' | 'delete' | 'create_table' | 'alter_add_column') => void
  objectType: ObjectType
}) {
  const isFunction = objectType === 'function' || objectType === 'procedure'
  const isTableLike = objectType === 'table' || objectType === 'view' || objectType === 'materialized_view'
  const isTable = objectType === 'table'
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  const handleSubmenuEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setSubmenuOpen(true)
  }

  const handleSubmenuLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setSubmenuOpen(false)
    }, 100)
  }

  const closeMenu = () => {
    setSubmenuOpen(false)
    setContextMenu(null)
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 w-full px-2 py-0.5 text-[13px] text-gray-700 rounded cursor-pointer",
          isSelected ? "bg-blue-100 text-blue-900" : "hover:bg-gray-50"
        )}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <span className="flex-1 truncate">{highlightMatch(objectName, searchQuery)}</span>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.stopPropagation()
            onViewSchema()
          }}
          title={isFunction ? "View definition" : "View schema"}
        >
          <Info className="size-3.5" />
        </button>
      </div>
      {contextMenu && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="min-w-32 rounded-lg border bg-popover shadow-lg p-1"
            onMouseLeave={() => {
              if (!submenuOpen) {
                closeMenu()
              }
            }}
          >
            <button
              className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onDoubleClick()
                closeMenu()
              }}
            >
              {isFunction ? 'Edit Definition' : 'Select Rows'}
            </button>
            <button
              className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onViewSchema()
                closeMenu()
              }}
            >
              {isFunction ? 'View Definition' : 'View Schema'}
            </button>
            {isTableLike && onGenerateSQL && (
              <>
                <div className="mx-2 my-1 h-px bg-border" />
                <div
                  className="relative"
                  onMouseEnter={handleSubmenuEnter}
                  onMouseLeave={handleSubmenuLeave}
                >
                  <button
                    className={cn(
                      "flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      submenuOpen && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="whitespace-nowrap">Quick SQL</span>
                    <ChevronRightIcon className="ml-auto size-4 opacity-80" />
                  </button>
                  {submenuOpen && (
                    <div
                      className="absolute left-full top-0 ml-0 min-w-24 rounded-lg border bg-popover shadow-lg p-1"
                      onMouseEnter={handleSubmenuEnter}
                      onMouseLeave={handleSubmenuLeave}
                    >
                      <button
                        className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          onGenerateSQL('select')
                          closeMenu()
                        }}
                      >
                        SELECT
                      </button>
                      {isTable && (
                        <>
                          <button
                            className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              onGenerateSQL('insert')
                              closeMenu()
                            }}
                          >
                            INSERT
                          </button>
                          <button
                            className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              onGenerateSQL('update')
                              closeMenu()
                            }}
                          >
                            UPDATE
                          </button>
                          <button
                            className="flex w-full min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              onGenerateSQL('delete')
                              closeMenu()
                            }}
                          >
                            DELETE
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Invisible backdrop to close menu when clicking outside */}
          <div
            className="fixed inset-0 -z-10"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeMenu()
            }}
          />
        </div>
      )}
    </>
  )
}

export function ObjectTree(props: ObjectTreeProps) {
  const { tables, views, materializedViews, functions, procedures, connectionId: _connectionId, ...shared } = props

  return (
    <ScrollArea className="flex-1">
      <div className="py-1 px-2">
        <ObjectSection title="Tables" icon={Grid3x3} objects={tables} objectType="table" {...shared} />
        <ObjectSection title="Views" icon={Eye} objects={views} objectType="view" {...shared} />
        <ObjectSection title="Materialized" icon={Layers} objects={materializedViews} objectType="materialized_view" {...shared} />
        <ObjectSection title="Functions" icon={FunctionSquare} objects={functions} objectType="function" {...shared} />
        <ObjectSection title="Procedures" icon={Code} objects={procedures} objectType="procedure" {...shared} />
      </div>
    </ScrollArea>
  )
}

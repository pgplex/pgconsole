import { useState } from 'react'
import { Expand, KeyRound, Table2 } from 'lucide-react'
import { useColumns, useFunctionInfo } from '../../hooks/useQuery'
import { ScrollArea } from '../ui/scroll-area'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipPopup, TooltipProvider } from '../ui/tooltip'
import { SQLDefinition } from './schema/shared'
import { FunctionDefinitionModal } from './FunctionDefinitionModal'
import { FunctionArgumentList } from './FunctionArgumentForm'
import { parseFunctionArguments } from '@/lib/sql/parse-function-args'
import type { SelectedObject } from './SQLEditorLayout'
import type { ObjectType } from './ObjectTree'
import type { ColumnInfo } from '@/gen/query_pb'

interface ContextPanelProps {
  connectionId: string
  selectedObject: SelectedObject | null
  onViewSchema?: (schema: string, name: string, objectType: ObjectType, args?: string) => void
}

function ContextPanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-10 px-3 flex items-center border-b border-gray-200">
      {children}
    </div>
  )
}

function LoadingState({ message }: { message: string }) {
  return <div className="p-3 text-sm text-gray-500">{message}</div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-3 text-sm text-gray-500">{message}</div>
}

function ColumnTooltipContent({ col }: { col: ColumnInfo }) {
  return (
    <div className="space-y-1.5 min-w-[160px]">
      <div className="font-medium">{col.name}</div>
      <div className="space-y-0.5 text-gray-600">
        <div className="flex justify-between gap-4">
          <span>Type:</span>
          <span className="text-gray-900">{col.type}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Nullable:</span>
          <span className="text-gray-900">{col.nullable ? 'Yes' : 'No'}</span>
        </div>
        {col.isPrimaryKey && (
          <div className="flex justify-between gap-4">
            <span>Primary Key:</span>
            <span className="text-gray-900">Yes</span>
          </div>
        )}
        {col.defaultValue && (
          <div className="flex justify-between gap-4">
            <span>Default:</span>
            <span className="text-gray-900 font-mono text-[10px]">{col.defaultValue}</span>
          </div>
        )}
      </div>
      {col.comment && (
        <div className="pt-1 border-t border-gray-200 text-gray-600 text-[11px]">
          {col.comment}
        </div>
      )}
    </div>
  )
}

export function ContextPanel({ connectionId, selectedObject, onViewSchema }: ContextPanelProps) {
  const [showDefinitionModal, setShowDefinitionModal] = useState(false)

  const isFunction = selectedObject?.type === 'function' || selectedObject?.type === 'procedure'
  const isTableLike = selectedObject?.type === 'table' || selectedObject?.type === 'view' || selectedObject?.type === 'materialized_view'

  const { data: columns, isLoading: columnsLoading } = useColumns(
    connectionId,
    isTableLike ? selectedObject?.schema ?? '' : '',
    isTableLike ? selectedObject?.name ?? '' : ''
  )

  const { data: functionInfo, isLoading: functionLoading } = useFunctionInfo(
    connectionId,
    selectedObject?.schema ?? '',
    isFunction ? selectedObject?.name ?? '' : '',
    selectedObject?.arguments
  )

  if (!selectedObject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4">
        <Table2 className="size-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Select an object from the sidebar</p>
      </div>
    )
  }

  if (isFunction) {
    const parsedArgs = functionInfo?.arguments
      ? parseFunctionArguments(functionInfo.arguments)
      : []

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <ContextPanelHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-sm truncate">{selectedObject.name}</span>
              <Badge variant="muted" className="text-xs shrink-0">{selectedObject.schema}</Badge>
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 ml-2"
              onClick={() => setShowDefinitionModal(true)}
              disabled={!functionInfo?.definition}
            >
              <Expand className="w-3.5 h-3.5" />
            </Button>
          </div>
        </ContextPanelHeader>
        <ScrollArea className="flex-1">
          {functionLoading ? (
            <LoadingState message="Loading..." />
          ) : (
            <div className="p-2 space-y-3">
              {parsedArgs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">Arguments</div>
                  <FunctionArgumentList arguments={parsedArgs} />
                </div>
              )}
              {functionInfo?.definition && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">Definition</div>
                  <SQLDefinition sql={functionInfo.definition} />
                </div>
              )}
              {!functionInfo?.definition && parsedArgs.length === 0 && (
                <EmptyState message="No definition" />
              )}
            </div>
          )}
        </ScrollArea>
        <FunctionDefinitionModal
          open={showDefinitionModal}
          onClose={() => setShowDefinitionModal(false)}
          name={selectedObject.name}
          schema={selectedObject.schema}
          definition={functionInfo?.definition ?? ''}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ContextPanelHeader>
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            className="font-medium text-sm truncate hover:underline"
            onClick={() => onViewSchema?.(selectedObject.schema, selectedObject.name, selectedObject.type)}
          >
            {selectedObject.name}
          </button>
          <Badge variant="muted" className="text-xs">{selectedObject.schema}</Badge>
        </div>
      </ContextPanelHeader>
      <ScrollArea className="flex-1">
        {columnsLoading ? (
          <LoadingState message="Loading columns..." />
        ) : columns && columns.length > 0 ? (
          <TooltipProvider>
            <div className="py-1">
              {columns.map((col) => (
                <Tooltip key={col.name}>
                  <TooltipTrigger
                    className="flex items-center justify-between px-2 py-0.5 hover:bg-gray-100 rounded text-sm w-full text-left"
                  >
                    <span className="truncate flex items-center gap-1">
                      {col.isPrimaryKey && <KeyRound className="size-3 text-amber-500 shrink-0" />}
                      {col.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-2 shrink-0">
                      {col.type}
                      {!col.nullable && <span className="text-red-400 ml-1">*</span>}
                    </span>
                  </TooltipTrigger>
                  <TooltipPopup side="left" sideOffset={8}>
                    <ColumnTooltipContent col={col} />
                  </TooltipPopup>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        ) : (
          <EmptyState message="No columns" />
        )}
      </ScrollArea>
    </div>
  )
}

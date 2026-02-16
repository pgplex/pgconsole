import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { SearchInput } from '../ui/search-input'
import { SchemaSelector } from './SchemaSelector'
import { ObjectTree, type ObjectType } from './ObjectTree'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { useMaterializedViews, useFunctions, useProcedures, useRefreshSchemaCache, queryKeys, connectionKeys } from '../../hooks/useQuery'
import type { SelectedObject } from './SQLEditorLayout'

interface ObjectSidebarProps {
  connectionId: string
  selectedObject: SelectedObject | null
  onObjectSelect: (obj: SelectedObject | null) => void
  onObjectDoubleClick: (schema: string, objectName: string, objectType: ObjectType) => void
  onViewSchema: (schema: string, objectName: string, objectType: ObjectType) => void
  onGenerateSQL?: (schema: string, objectName: string, objectType: ObjectType, sqlType: 'select' | 'insert' | 'update' | 'delete' | 'create_table' | 'alter_add_column') => void
  selectedSchema: string | null
  onSchemaChange: (schema: string | null) => void
  onNewQuery?: (content?: string) => string
  // Data passed from parent (fetched in useEditorNavigation)
  schemas: string[]
  tables: Array<{ name: string; type: string }>
  isSchemasLoading: boolean
  isTablesLoading: boolean
  schemasError: Error | null
  tablesError: Error | null
}

export function ObjectSidebar({
  connectionId,
  selectedObject,
  onObjectSelect,
  onObjectDoubleClick,
  onViewSchema,
  onGenerateSQL,
  selectedSchema,
  onSchemaChange,
  onNewQuery,
  schemas,
  tables,
  isSchemasLoading,
  isTablesLoading,
  schemasError,
  tablesError,
}: ObjectSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  // AI schema cache refresh
  const { mutate: refreshSchemaCache } = useRefreshSchemaCache()

  // Fetch materialized views, functions, and procedures
  const { data: materializedViewsData = [], isLoading: mvLoading, error: mvError, refetch: refetchMaterializedViews } = useMaterializedViews(connectionId, selectedSchema || '')
  const { data: functionsData = [], isLoading: functionsLoading, error: functionsError, refetch: refetchFunctions } = useFunctions(connectionId, selectedSchema || '')
  const { data: proceduresData = [], isLoading: proceduresLoading, error: proceduresError, refetch: refetchProcedures } = useProcedures(connectionId, selectedSchema || '')

  // Separate tables and views
  const tablesList = tables.filter(t => t.type === 'table')
  const viewsList = tables.filter(t => t.type === 'view')

  const isLoading = isSchemasLoading || isTablesLoading || mvLoading || functionsLoading || proceduresLoading
  const hasError = schemasError || tablesError || mvError || functionsError || proceduresError

  // Get the first error message
  const errorMessage = schemasError?.message || tablesError?.message || mvError?.message || functionsError?.message || proceduresError?.message

  const handleRefresh = () => {
    // Invalidate queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: queryKeys.schemas(connectionId) })
    if (selectedSchema) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables(connectionId, selectedSchema) })
    }
    refetchMaterializedViews()
    refetchFunctions()
    refetchProcedures()
    // Also refresh connection health indicator
    queryClient.invalidateQueries({ queryKey: [...connectionKeys.all, 'health', connectionId] })
    // Also refresh AI schema cache
    refreshSchemaCache({ connectionId, schemas: selectedSchema ? [selectedSchema] : [] })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 pt-2 space-y-2">
        <div className="flex gap-1 items-center">
          <SchemaSelector
            value={selectedSchema || ''}
            onChange={onSchemaChange}
            schemas={schemas}
            disabled={isSchemasLoading}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-2 w-2" />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              Refresh
            </TooltipContent>
          </Tooltip>
          {onNewQuery && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 font-mono font-semibold"
                    onClick={() => onNewQuery()}
                  >
                    SQL
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                New Query
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          size="sm"
        />
      </div>
      {hasError ? (
        <div className="flex-1 flex flex-col items-center justify-center text-red-500 text-sm px-4 text-center gap-2">
          <div>Failed to load schema</div>
          {errorMessage && (
            <div className="text-xs text-gray-600 max-w-full break-words">{errorMessage}</div>
          )}
          <div className="text-xs text-gray-500">Use the refresh button above to retry</div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Loading...
        </div>
      ) : (
        <ObjectTree
          tables={tablesList}
          views={viewsList}
          materializedViews={materializedViewsData}
          functions={functionsData}
          procedures={proceduresData}
          searchQuery={searchQuery}
          selectedObject={selectedObject}
          onObjectSelect={onObjectSelect}
          onObjectDoubleClick={onObjectDoubleClick}
          onViewSchema={onViewSchema}
          onGenerateSQL={onGenerateSQL}
          schema={selectedSchema || ''}
          connectionId={connectionId}
        />
      )}
    </div>
  )
}

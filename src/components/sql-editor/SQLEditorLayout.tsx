import { useState, useCallback, useEffect, useRef } from 'react'
import { ObjectSidebar } from './ObjectSidebar'
import { EditorArea } from './EditorArea'
import { RightPanel } from './RightPanel'
import { ResizeHandle } from '../ui/resize-handle'
import type { useEditorTabs } from './hooks/useEditorTabs'
import { useExecuteSQL } from '../../hooks/useQuery'
import { useSchemaStoreSync } from '../../hooks/useSchemaStoreSync'
import { schemaStore } from '@/lib/schema-store'
import { queryClient as rpcClient } from '@/lib/connect-client'
import { generateSelect, generateInsert, generateUpdate, generateDelete, generateCreateTable, generateAlterAddColumn } from '@/lib/sql/generate'
import { toastManager } from '../ui/toast'
import type { ObjectType } from './ObjectTree'
import type { SelectedObject } from '@/hooks/useEditorNavigation'

interface SQLEditorLayoutProps {
  connectionId: string
  editorTabs: ReturnType<typeof useEditorTabs>
  selectedSchema: string | null
  selectedObject: SelectedObject | null
  onSchemaChange: (schema: string | null) => void
  onObjectSelect: (obj: SelectedObject | null, options?: { replace?: boolean }) => void
  schemas: string[]
  tables: Array<{ name: string; type: string }>
  isSchemasLoading: boolean
  isTablesLoading: boolean
  schemasError: Error | null
  tablesError: Error | null
}

// Re-export SelectedObject for backward compatibility
export type { SelectedObject } from '@/hooks/useEditorNavigation'

const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 600
const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 400

export function SQLEditorLayout({
  connectionId,
  editorTabs,
  selectedSchema,
  selectedObject,
  onSchemaChange,
  onObjectSelect,
  schemas,
  tables,
  isSchemasLoading,
  isTablesLoading,
  schemasError,
  tablesError,
}: SQLEditorLayoutProps) {
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const insertAtCursorRef = useRef<((text: string) => void) | null>(null)
  const executeSQL = useExecuteSQL()
  const [initialPrompt, setInitialPrompt] = useState<{ sql: string; action: 'explain' } | null>(null)

  // Sync schema store with React Query data
  useSchemaStoreSync(connectionId, selectedSchema)

  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPanel(true)
  }, [])

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingSidebar(true)
  }, [])

  useEffect(() => {
    if (!isDraggingPanel) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX
      const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, MAX_PANEL_WIDTH))
      editorTabs.setRightPanelWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsDraggingPanel(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPanel, editorTabs])

  useEffect(() => {
    if (!isDraggingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH))
      editorTabs.setLeftSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsDraggingSidebar(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSidebar, editorTabs])

  // Track previous selectedObject to detect changes from URL navigation (browser back/forward)
  const prevSelectedObjectRef = useRef<SelectedObject | null>(null)

  // Sync schema tab when selectedObject changes (e.g., browser back/forward)
  useEffect(() => {
    const prev = prevSelectedObjectRef.current
    const curr = selectedObject

    // Check if object actually changed
    const changed = curr && (!prev ||
      prev.schema !== curr.schema ||
      prev.name !== curr.name ||
      prev.type !== curr.type ||
      prev.arguments !== curr.arguments)

    // Update ref
    prevSelectedObjectRef.current = curr

    if (changed) {
      // Update schemaStore for autocomplete
      if (curr.type === 'table' || curr.type === 'view' || curr.type === 'materialized_view') {
        schemaStore.setSelectedTable({ schema: curr.schema, name: curr.name })
      } else {
        schemaStore.setSelectedTable(null)
      }

      // If no active tab or viewing a schema tab, switch to the object's schema tab
      // If viewing a query tab, don't interrupt SQL editing
      const activeTabType = editorTabs.activeTab?.tab.type
      if (!activeTabType || activeTabType === 'schema') {
        editorTabs.createSchemaTab(curr.schema, curr.name, curr.type, curr.arguments)
      }
    }
  }, [selectedObject, editorTabs])

  const handleObjectSelect = (obj: SelectedObject | null) => {
    // Update URL - the effect above handles schemaStore and schema tab sync
    onObjectSelect(obj)
  }

  const handleViewSchema = (schema: string, objectName: string, objectType: ObjectType, args?: string) => {
    // Update URL and push to browser history (replace: false)
    onObjectSelect({ schema, name: objectName, type: objectType, arguments: args }, { replace: false })
    // Create/switch to schema tab
    editorTabs.createSchemaTab(schema, objectName, objectType, args)
  }

  const handleObjectDoubleClick = async (schema: string, objectName: string, objectType: ObjectType, args?: string) => {
    // For functions/procedures, open the schema tab (which includes edit functionality)
    if (objectType === 'function' || objectType === 'procedure') {
      editorTabs.createSchemaTab(schema, objectName, objectType, args)
      return
    }

    // For tables/views, run SELECT query
    const query = `SELECT * FROM ${schema}.${objectName} LIMIT 100;`

    // Check if a tab with the same SQL statement already exists
    const existingTab = editorTabs.tabs.find(
      (t) => t.tab.type === 'query' && t.tab.content.trim() === query.trim()
    )

    let tabId: string
    if (existingTab) {
      tabId = existingTab.tab.id
      editorTabs.setActiveTabId(tabId)
      editorTabs.setTabExecuting(tabId, true)
    } else {
      tabId = editorTabs.createTab(query, { isExecuting: true })
    }

    try {
      // Build search_path: selected schema first, then public (if not already public)
      const selectedSchema = schemaStore.getSelectedSchema()
      const searchPath = selectedSchema
        ? (selectedSchema === 'public' ? 'public' : `${selectedSchema}, public`)
        : undefined

      const result = await executeSQL.mutateAsync({
        connectionId,
        sql: query,
        searchPath,
      })
      editorTabs.setTabResults(tabId, [{
        columns: result.error ? [] : result.columns,
        rows: result.error ? [] : result.rows,
        rowCount: result.error ? 0 : result.rowCount,
        executionTime: result.executionTime,
        error: result.error || undefined,
      }], { isExecuting: false, sql: query })
    } catch (err) {
      editorTabs.setTabResults(tabId, [{
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: err instanceof Error ? err.message : 'Query execution failed',
      }], { isExecuting: false })
    }
  }

  const handleRunSQL = async (sql: string) => {
    let tabId: string

    // If there's an active tab, use it; otherwise create a new one
    if (editorTabs.activeTab?.tab.type === 'query') {
      tabId = editorTabs.activeTab.tab.id
      editorTabs.setTabExecuting(tabId, true)
    } else {
      // No active tab or not a query tab, create an empty query tab
      tabId = editorTabs.createTab('', { isExecuting: true })
    }

    try {
      // Build search_path: selected schema first, then public (if not already public)
      const selectedSchema = schemaStore.getSelectedSchema()
      const searchPath = selectedSchema
        ? (selectedSchema === 'public' ? 'public' : `${selectedSchema}, public`)
        : undefined

      const result = await executeSQL.mutateAsync({
        connectionId,
        sql,
        searchPath,
      })
      editorTabs.setTabResults(tabId, [{
        columns: result.error ? [] : result.columns,
        rows: result.error ? [] : result.rows,
        rowCount: result.error ? 0 : result.rowCount,
        executionTime: result.executionTime,
        error: result.error || undefined,
      }], { isExecuting: false, sql })
    } catch (err) {
      editorTabs.setTabResults(tabId, [{
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: err instanceof Error ? err.message : 'Query execution failed',
      }], { isExecuting: false })
    }
  }

  const handleInitialPromptProcessed = useCallback(() => setInitialPrompt(null), [])

  const handleExplainWithAI = (sql: string) => {
    // Open right panel and switch to chat tab
    editorTabs.setRightPanelOpen(true)
    editorTabs.setRightPanelActiveTab('chat')
    // Set the initial prompt
    setInitialPrompt({ sql, action: 'explain' })
  }

  const handleGenerateSQL = async (
    schema: string,
    objectName: string,
    _objectType: ObjectType,
    sqlType: 'select' | 'insert' | 'update' | 'delete' | 'create_table' | 'alter_add_column'
  ) => {
    try {
      let sql: string

      if (sqlType === 'select') {
        sql = await generateSelect(objectName)
      } else if (sqlType === 'alter_add_column') {
        sql = await generateAlterAddColumn(objectName)
      } else if (sqlType === 'create_table') {
        sql = await generateCreateTable()
      } else {
        // Fetch columns for INSERT/UPDATE
        const columnsResponse = await rpcClient.getColumns({
          connectionId,
          schema,
          table: objectName,
        })
        const columns = columnsResponse.columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
        }))

        if (columns.length === 0) {
          toastManager.add({
            title: 'Cannot generate SQL',
            description: 'Table has no columns',
            type: 'error',
          })
          return
        }

        if (sqlType === 'insert') {
          sql = await generateInsert(objectName, columns)
        } else {
          // Fetch constraints for UPDATE/DELETE to find PK columns
          const constraintsResponse = await rpcClient.getConstraints({
            connectionId,
            schema,
            table: objectName,
          })
          const pkConstraint = constraintsResponse.constraints.find(
            (c) => c.type === 'PRIMARY KEY'
          )
          const pkColumns = pkConstraint?.columns ?? []

          if (sqlType === 'update') {
            sql = await generateUpdate(objectName, columns, pkColumns)
          } else {
            sql = await generateDelete(objectName, pkColumns)
          }
        }
      }

      // Check if there's an active query tab
      const hasActiveQueryTab = editorTabs.activeTab?.tab.type === 'query'

      if (hasActiveQueryTab && insertAtCursorRef.current) {
        insertAtCursorRef.current(sql)
      } else {
        // Create a new tab with the generated SQL
        editorTabs.createTab(sql)
      }
    } catch (err) {
      toastManager.add({
        title: 'Failed to generate SQL',
        description: err instanceof Error ? err.message : 'Unknown error',
        type: 'error',
      })
    }
  }

  return (
    <div ref={containerRef} className="flex flex-1 h-full overflow-hidden">
      <div className="flex-shrink-0" style={{ width: editorTabs.leftSidebarWidth }}>
        <ObjectSidebar
          connectionId={connectionId}
          selectedObject={selectedObject}
          onObjectSelect={handleObjectSelect}
          onObjectDoubleClick={handleObjectDoubleClick}
          onViewSchema={handleViewSchema}
          onGenerateSQL={handleGenerateSQL}
          selectedSchema={selectedSchema}
          onSchemaChange={onSchemaChange}
          onNewQuery={editorTabs.createTab}
          schemas={schemas}
          tables={tables}
          isSchemasLoading={isSchemasLoading}
          isTablesLoading={isTablesLoading}
          schemasError={schemasError}
          tablesError={tablesError}
        />
      </div>
      <ResizeHandle
        direction="vertical"
        isDragging={isDraggingSidebar}
        onMouseDown={handleSidebarResizeStart}
      />
      <div className="flex-1 min-w-0">
        <EditorArea
          editorTabs={editorTabs}
          connectionId={connectionId}
          selectedSchema={selectedSchema}
          rightPanelOpen={editorTabs.rightPanel.open}
          onRightPanelToggle={() => editorTabs.setRightPanelOpen(!editorTabs.rightPanel.open)}
          onEditorReady={(insertFn) => { insertAtCursorRef.current = insertFn }}
          selectedObject={selectedObject}
          onGenerateSQL={handleGenerateSQL}
          onExplainWithAI={handleExplainWithAI}
          onViewSchema={handleViewSchema}
        />
      </div>
      {editorTabs.rightPanel.open && (
        <ResizeHandle
          direction="vertical"
          isDragging={isDraggingPanel}
          onMouseDown={handlePanelResizeStart}
        />
      )}
      <RightPanel
        open={editorTabs.rightPanel.open}
        width={editorTabs.rightPanel.width}
        activeTab={editorTabs.rightPanel.activeTab}
        onActiveTabChange={editorTabs.setRightPanelActiveTab}
        connectionId={connectionId}
        selectedObject={selectedObject}
        selectedSchema={selectedSchema ?? undefined}
        onInsertSQL={(sql) => {
          if (editorTabs.activeTab && editorTabs.activeTab.tab.type === 'query' && insertAtCursorRef.current) {
            insertAtCursorRef.current(sql)
          } else {
            editorTabs.createTab(sql)
          }
        }}
        onRunSQL={handleRunSQL}
        onViewSchema={handleViewSchema}
        initialPrompt={initialPrompt}
        onInitialPromptProcessed={handleInitialPromptProcessed}
      />
    </div>
  )
}

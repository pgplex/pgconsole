import { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronDown, Activity } from 'lucide-react'
import { EditorTabs } from './EditorTabs'
import { QueryEditor, type QueryEditorHandle, type CursorPosition } from './QueryEditor'
import { QueryResults } from './QueryResults'
import { SchemaTabContent } from './SchemaTabContent'
import { ProcessesModal } from './ProcessesModal'
import { Button } from '../ui/button'
import { Kbd } from '../ui/kbd'
import { ResizeHandle } from '../ui/resize-handle'
import { Menu, MenuTrigger, MenuPopup, MenuItem } from '../ui/menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import type { useEditorTabs, QueryResult } from './hooks/useEditorTabs'
import type { SelectedObject } from './SQLEditorLayout'
import type { ObjectType } from './ObjectTree'
import { useQueryClient } from '@tanstack/react-query'
import { useExecuteSQL, useCancelQuery } from '../../hooks/useQuery'
import { useConnectionPermissions } from '../../hooks/usePermissions'
import { getEditorInfo, formatSql, formatSqlOneLine, parseSql, isDDLStatement } from '@/lib/sql'
import { aiClient } from '@/lib/connect-client'
import { schemaStore } from '@/lib/schema-store'

interface EditorAreaProps {
  editorTabs: ReturnType<typeof useEditorTabs>
  connectionId: string
  selectedSchema: string | null
  rightPanelOpen: boolean
  onRightPanelToggle: () => void
  onEditorReady?: (insertAtCursor: (text: string) => void) => void
  selectedObject: SelectedObject | null
  onGenerateSQL: (schema: string, objectName: string, objectType: ObjectType, sqlType: 'select' | 'insert' | 'update' | 'delete' | 'create_table' | 'alter_add_column') => void
  onExplainWithAI: (sql: string) => void
  onViewSchema: (schema: string, objectName: string, objectType: ObjectType, args?: string) => void
}

export function EditorArea({ editorTabs, connectionId, selectedSchema, rightPanelOpen, onRightPanelToggle, onEditorReady, selectedObject, onGenerateSQL, onExplainWithAI, onViewSchema }: EditorAreaProps) {
  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    createTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    updateTabContent,
    setTabResults,
    setActiveResultTab,
    setTabExecuting,
    setEditorHeight,
    setFoldedRanges,
    getFoldedRanges,
  } = editorTabs

  const queryClient = useQueryClient()
  const executeSQL = useExecuteSQL()
  const cancelQuery = useCancelQuery()
  const { hasExplain } = useConnectionPermissions(connectionId)
  const editorRef = useRef<QueryEditorHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Expose insertAtCursor to parent
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady((text: string) => {
        editorRef.current?.insertAtCursor(text)
      })
    }
  }, [onEditorReady])
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentQueryIdRef = useRef<string | null>(null)
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1, offset: 0, length: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [executingPid, setExecutingPid] = useState<number | null>(null)
  const [processesOpen, setProcessesOpen] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewritingTooltipPos, setRewritingTooltipPos] = useState<number | null>(null)

  // 0 means equal split (50/50), 0 < value < 1 means ratio of container height
  // Values >= 1 are legacy pixel values, treat as equal split
  const storedHeight = activeTab?.editorHeight ?? 0
  const isEqualSplit = storedHeight === 0 || storedHeight >= 1
  const editorHeightPercent = isEqualSplit ? 50 : storedHeight * 100

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !activeTabId) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newHeight = e.clientY - containerRect.top
      // Calculate ratio and clamp between 0.1 and 0.9 (10% to 90%)
      const ratio = newHeight / containerRect.height
      const clampedRatio = Math.max(0.1, Math.min(ratio, 0.9))
      setEditorHeight(activeTabId, clampedRatio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, activeTabId, setEditorHeight])

  const splitStatements = async (sql: string): Promise<{ text: string; offsetInSql: number }[]> => {
    const { statementRanges } = await getEditorInfo(sql)
    return statementRanges.length > 0
      ? statementRanges
          .map((r) => ({ text: sql.slice(r.from, r.to).trim(), offsetInSql: r.from }))
          .filter(s => s.text)
      : [{ text: sql.trim(), offsetInSql: 0 }]
  }

  const handleExecute = async (sqlFromKeymap?: string) => {
    if (!activeTab || activeTab.tab.type !== 'query') return

    // Use SQL from keymap if provided, otherwise get from editor ref (for button click)
    const sql = sqlFromKeymap ?? editorRef.current?.getSqlToExecute() ?? activeTab.tab.content
    if (!sql.trim()) return

    // Create new abort controller for this execution
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    // Generate a unique query ID for this execution
    const queryId = `${activeTabId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    currentQueryIdRef.current = queryId

    setTabExecuting(activeTabId, true)
    editorRef.current?.setErrorLine(null)
    let ddlExecutedSuccessfully = false

    // Compute starting line of the executed sql within the full editor content
    const fullContent = editorRef.current?.getContent() ?? ''
    const sqlOffset = fullContent.indexOf(sql)
    const sqlStartLine = sqlOffset >= 0 ? fullContent.slice(0, sqlOffset).split('\n').length : 1

    try {
      const statements = await splitStatements(sql)

      // Execute each statement and collect results
      const results: QueryResult[] = []
      for (const { text: stmt, offsetInSql } of statements) {
        // Check if cancelled before each statement - just stop, don't add result for unexecuted statements
        if (signal.aborted) {
          break
        }

        try {
          // Build search_path: selected schema first, then public (if not already public)
          const searchPath = selectedSchema
            ? (selectedSchema === 'public' ? 'public' : `${selectedSchema}, public`)
            : undefined

          const result = await executeSQL.mutateAsync({
            connectionId,
            sql: stmt,
            queryId: currentQueryIdRef.current,
            searchPath,
            onPid: (pid) => setExecutingPid(pid),
          })

          if (result.error) {
            results.push({
              columns: [],
              rows: [],
              rowCount: 0,
              executionTime: result.executionTime,
              error: result.error,
            })
            // Highlight the error line in the editor gutter
            const match = result.error.match(/^ERROR at Line (\d+):/)
            if (match) {
              const errorLineInStmt = parseInt(match[1], 10)
              const linesBeforeStmt = sql.slice(0, offsetInSql).split('\n').length - 1
              editorRef.current?.setErrorLine(sqlStartLine + linesBeforeStmt + errorLineInStmt - 1)
            }
          } else {
            results.push({
              columns: result.columns,
              rows: result.rows,
              rowCount: result.rowCount,
              executionTime: result.executionTime,
            })

            // Check if this was a DDL statement that succeeded
            if (!ddlExecutedSuccessfully) {
              try {
                const parsed = await parseSql(stmt)
                if (parsed.statements.length > 0 && isDDLStatement(parsed.statements[0].kind)) {
                  ddlExecutedSuccessfully = true
                }
              } catch {
                // Ignore parse errors - statement already executed successfully
              }
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Query execution failed'
          results.push({
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime: 0,
            error: errorMessage,
          })
          // If cancelled, stop processing remaining statements
          if (signal.aborted) {
            break
          }
        }
      }

      setTabResults(activeTabId, results, { isExecuting: false, sql })

      // Refresh schema if any DDL statement executed successfully
      if (ddlExecutedSuccessfully) {
        // Invalidate all schema-related queries for this connection
        // Using predicate to match all queries containing this connectionId
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'query' && key.includes(connectionId)
          },
        })
      }
    } catch (err) {
      // If something went wrong before results could be set, show error and clear executing state
      setTabResults(activeTabId, [{
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: err instanceof Error ? err.message : 'Query execution failed',
      }], { isExecuting: false })
    } finally {
      abortControllerRef.current = null
      currentQueryIdRef.current = null
      setIsCancelling(false)
      setExecutingPid(null)
    }
  }

  const handleCancelQuery = useCallback(async () => {
    setIsCancelling(true)

    // Abort the local controller first for immediate UI feedback
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Also cancel on the backend
    if (currentQueryIdRef.current) {
      try {
        await cancelQuery.mutateAsync({
          connectionId,
          queryId: currentQueryIdRef.current,
        })
      } catch {
        // Ignore cancel errors - the query may have already completed
      }
    }
  }, [connectionId, cancelQuery])

  const handleRefreshQuery = useCallback(async (sql: string) => {
    if (!activeTab || activeTab.tab.type !== 'query') return
    // Execute the query to refresh results
    await handleExecute(sql)
  }, [activeTab, handleExecute])

  const handleExplain = useCallback(async () => {
    const sql = editorRef.current?.getSqlToExecute()
    if (!sql?.trim()) return

    const statements = await splitStatements(sql)
    const explainableKinds = new Set(['select', 'insert', 'update', 'delete'])

    const explainQueries = await Promise.all(
      statements.map(async ({ text: stmt }) => {
        const parsed = await parseSql(stmt)
        if (parsed.statements.length > 0 && explainableKinds.has(parsed.statements[0].kind)) {
          return `EXPLAIN ${stmt}`
        }
        return null
      })
    )

    const validQueries = explainQueries.filter(Boolean) as string[]
    if (validQueries.length === 0) return

    handleExecute(validQueries.join(';\n'))
  }, [handleExecute])

  const handleFormat = useCallback(async (mode: 'pretty' | 'oneline' = 'pretty') => {
    if (!activeTab || activeTab.tab.type !== 'query') return

    const selection = editorRef.current?.getSelection()

    if (selection) {
      const formatted = mode === 'oneline'
        ? formatSqlOneLine(selection.text)
        : await formatSql(selection.text)
      editorRef.current?.replaceRange(selection.from, selection.to, formatted)
    } else {
      const content = editorRef.current?.getContent() ?? activeTab.tab.content
      const formatted = mode === 'oneline'
        ? formatSqlOneLine(content)
        : await formatSql(content)
      editorRef.current?.replaceRange(0, content.length, formatted)
    }
  }, [activeTab])

  const handleExplainWithAIFromEditor = useCallback(() => {
    const sql = editorRef.current?.getSqlToExecute()
    if (sql?.trim()) {
      onExplainWithAI(sql)
    }
  }, [onExplainWithAI])

  const handleRewriteWithAIFromEditor = useCallback(async () => {
    if (!activeTab || activeTab.tab.type !== 'query' || isRewriting) return

    // Get active statement range for tooltip positioning and rewriting
    const statementRange = await editorRef.current?.getActiveStatementRange()
    if (!statementRange) return

    const { from, to } = statementRange

    // Get the SQL to rewrite (active statement)
    const sql = editorRef.current?.getSqlToExecute()
    if (!sql?.trim()) return

    // Calculate tooltip position: beginning of the line where statement starts
    const tooltipPos = editorRef.current?.getTooltipPosition(from) ?? from

    setIsRewriting(true)
    setRewritingTooltipPos(tooltipPos)

    try {
      // Get AI providers
      const providersResponse = await aiClient.listAIProviders({})
      const providers = providersResponse.providers || []

      if (providers.length === 0) {
        // No AI providers configured - silently fail or show a toast
        setIsRewriting(false)
        setRewritingTooltipPos(null)
        return
      }

      // Use first available provider
      const selectedProvider = providers[0].id

      // Get schemas to send
      const selectedSchemaName = schemaStore.getSelectedSchema()
      const schemas = selectedSchemaName ? [selectedSchemaName] : []

      const response = await aiClient.rewriteSQL({
        connectionId,
        providerId: selectedProvider,
        sql,
        schemas,
      })

      if (response.error || !response.sql) {
        setIsRewriting(false)
        setRewritingTooltipPos(null)
        return
      }

      const formattedSql = await formatSql(response.sql)

      // Replace the active statement in the editor
      editorRef.current?.replaceRange(from, to, formattedSql)
    } catch (err) {
      console.error('Failed to rewrite SQL:', err)
    } finally {
      setIsRewriting(false)
      setRewritingTooltipPos(null)
    }
  }, [activeTab, connectionId, isRewriting])

  const handleFixWithAI = useCallback(async (errorMessage: string, errorFrom: number) => {
    if (!activeTab || activeTab.tab.type !== 'query' || isRewriting) return

    const content = editorRef.current?.getContent() ?? activeTab.tab.content

    // Try to find statement ranges, but if parsing fails (due to syntax errors),
    // fall back to using the entire content
    const { statementRanges } = await getEditorInfo(content)

    let from = 0
    let to = content.length

    if (statementRanges.length > 0) {
      // Find the statement containing the error
      const statement = statementRanges.find(r => errorFrom >= r.from && errorFrom <= r.to)
      if (statement) {
        from = statement.from
        to = statement.to
      }
    }

    const sql = content.slice(from, to)

    // Calculate tooltip position: beginning of the line where statement starts
    const tooltipPos = editorRef.current?.getTooltipPosition(from) ?? from

    setIsRewriting(true)
    setRewritingTooltipPos(tooltipPos)

    try {
      // Get AI providers
      const providersResponse = await aiClient.listAIProviders({})
      const providers = providersResponse.providers || []

      if (providers.length === 0) {
        setIsRewriting(false)
        setRewritingTooltipPos(null)
        return
      }

      // Use first available provider
      const selectedProvider = providers[0].id

      // Get schemas to send
      const selectedSchemaName = schemaStore.getSelectedSchema()
      const schemas = selectedSchemaName ? [selectedSchemaName] : []

      const response = await aiClient.fixSQL({
        connectionId,
        providerId: selectedProvider,
        sql,
        errorMessage,
        schemas,
      })

      if (response.error || !response.sql) {
        setIsRewriting(false)
        setRewritingTooltipPos(null)
        return
      }

      const formattedSql = await formatSql(response.sql)

      // Replace the erroring statement in the editor
      editorRef.current?.replaceRange(from, to, formattedSql)
    } catch (err) {
      console.error('Failed to fix SQL:', err)
    } finally {
      setIsRewriting(false)
      setRewritingTooltipPos(null)
    }
  }, [activeTab, connectionId, isRewriting])


  if (!activeTab) {
    return (
      <div className="h-full flex flex-col">
        <div className="relative flex items-center h-8 border-b border-gray-200 bg-gray-50 overflow-hidden">
          <EditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onCloseOthers={closeOtherTabs}
            onCloseToRight={closeTabsToRight}
            onCloseAll={closeAllTabs}
            rightPanelOpen={rightPanelOpen}
            onRightPanelToggle={onRightPanelToggle}
          />
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <p>No query tabs open</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => createTab()}
            >
              New Query
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="relative flex items-center h-8 border-b border-gray-200 bg-gray-50 overflow-hidden">
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={setActiveTabId}
          onTabClose={closeTab}
          onCloseOthers={closeOtherTabs}
          onCloseToRight={closeTabsToRight}
          onCloseAll={closeAllTabs}
          rightPanelOpen={rightPanelOpen}
          onRightPanelToggle={onRightPanelToggle}
        />
      </div>
      {activeTab.tab.type === 'schema' ? (
        <div className="flex-1 min-h-0">
          <SchemaTabContent
            connectionId={connectionId}
            schema={activeTab.tab.schema}
            table={activeTab.tab.table}
            objectType={activeTab.tab.objectType}
            arguments={activeTab.tab.arguments}
            onNewQuery={createTab}
            onViewSchema={onViewSchema}
            onExplainWithAI={onExplainWithAI}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 h-10 px-2 border-b border-gray-200 bg-white [&_button]:focus-visible:ring-0" onMouseDown={(e) => e.preventDefault()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExecute()}
              disabled={activeTab.isExecuting}
            >
              Run
              <Kbd className="h-auto min-w-0 bg-transparent px-0 text-inherit opacity-50">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}↵
              </Kbd>
            </Button>
            {hasExplain && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExplain}
                disabled={activeTab.isExecuting}
              >
                Explain
              </Button>
            )}
            <div className="flex">
              <Button
                variant="outline"
                size="sm"
                disabled={activeTab.isExecuting}
                onClick={() => handleFormat('pretty')}
                className="rounded-r-none border-r-0"
              >
                Format
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activeTab.isExecuting}
                      className="rounded-l-none px-1.5"
                    >
                      <ChevronDown className="size-3.5 opacity-50" />
                    </Button>
                  }
                />
                <MenuPopup align="end">
                  <MenuItem onClick={() => handleFormat('pretty')}>
                    Format
                  </MenuItem>
                  <MenuItem onClick={() => handleFormat('oneline')}>
                    Format to 1 line
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </div>
            {selectedObject && (selectedObject.type === 'table' || selectedObject.type === 'view' || selectedObject.type === 'materialized_view') && (
              <Menu>
                <MenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      Quick SQL
                      <ChevronDown className="size-3.5 ml-1 opacity-50" />
                    </Button>
                  }
                />
                <MenuPopup>
                  <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'select')}>
                    SELECT
                  </MenuItem>
                  {selectedObject.type === 'table' && (
                    <>
                      <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'insert')}>
                        INSERT
                      </MenuItem>
                      <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'update')}>
                        UPDATE
                      </MenuItem>
                      <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'delete')}>
                        DELETE
                      </MenuItem>
                      <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'create_table')}>
                        CREATE TABLE
                      </MenuItem>
                      <MenuItem onClick={() => onGenerateSQL(selectedObject.schema, selectedObject.name, selectedObject.type, 'alter_add_column')}>
                        ALTER TABLE ADD COLUMN
                      </MenuItem>
                    </>
                  )}
                </MenuPopup>
              </Menu>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProcessesOpen(true)}
            >
              <Activity className="size-3.5 mr-1" />
              Processes
            </Button>
          </div>
          <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
            <div
              style={{ height: `${editorHeightPercent}%` }}
              className="shrink-0 flex flex-col"
            >
              <div className="flex-1 min-h-0 relative">
                <QueryEditor
                  ref={editorRef}
                  key={activeTabId}
                  value={activeTab.tab.content}
                  onChange={(content) => {
                    updateTabContent(activeTabId, content)
                  }}
                  onExecute={handleExecute}
                  onCursorChange={setCursorPosition}
                  tabId={activeTabId}
                  initialFoldedRanges={getFoldedRanges(activeTabId)}
                  onFoldChange={(ranges) => setFoldedRanges(activeTabId, ranges)}
                  onRun={() => handleExecute()}
                  onExplain={hasExplain ? handleExplain : undefined}
                  onFormat={() => handleFormat('pretty')}
                  onExplainWithAI={handleExplainWithAIFromEditor}
                  onRewriteWithAI={handleRewriteWithAIFromEditor}
                  onFixWithAI={handleFixWithAI}
                  isRewriting={isRewriting}
                  rewritingTooltipPos={rewritingTooltipPos}
                />
              </div>
              <div className="h-6 px-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    search_path: {selectedSchema && selectedSchema !== 'public'
                      ? `${selectedSchema}, public`
                      : 'public'}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Schema search path for queries
                  </TooltipContent>
                </Tooltip>
                <span className="tabular-nums">
                  Ln {cursorPosition.line}, Col {cursorPosition.column}, Pos {cursorPosition.offset}/{cursorPosition.length}
                </span>
              </div>
            </div>
            <ResizeHandle
              direction="horizontal"
              isDragging={isDragging}
              onMouseDown={handleMouseDown}
            />
            <div className="flex-1 min-h-0">
              <QueryResults
                resultTabs={activeTab.resultTabs}
                activeResultTabId={activeTab.activeResultTabId}
                onResultTabChange={(resultTabId) => setActiveResultTab(activeTabId, resultTabId)}
                isExecuting={activeTab.isExecuting}
                isCancelling={isCancelling}
                executingPid={executingPid}
                onCancelQuery={handleCancelQuery}
                connectionId={connectionId}
                onRefreshQuery={handleRefreshQuery}
              />
            </div>
          </div>
        </>
      )}
      <ProcessesModal
        open={processesOpen}
        onOpenChange={setProcessesOpen}
        connectionId={connectionId}
      />
    </div>
  )
}

import { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronLeft, ChevronRight, Clipboard, Download, MoreHorizontal, X, Expand, Plus, Pin } from 'lucide-react'
import { TabBar } from '../ui/tab-bar'
import { SearchInput } from '../ui/search-input'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import type { QueryResult, ResultTab } from './hooks/useEditorTabs'
import { exportToCsv } from '@/lib/export-csv'
import { queryClient } from '@/lib/connect-client'
import { RowDetailPanel } from './RowDetailPanel'
import { JsonExpandModal } from './JsonExpandModal'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'
import { useRowSelection } from '@/hooks/useRowSelection'
import { useExecuteSQL } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'
import { StagedChangesModal } from './StagedChangesModal'
import { generateDeleteSQL, generateUpdateSQL, generateInsertSQL, type StagedChange } from '@/lib/staged-changes'

function isJsonType(type: string): boolean {
  return type === 'json' || type === 'jsonb'
}

// Simplified row tracking
type RowStatus = 'normal' | 'staged-delete' | 'staged-update' | 'staged-insert'

interface DisplayRow {
  data: Record<string, unknown>
  status: RowStatus
  originalData?: Record<string, unknown>  // For updates: original values for SQL generation and discard
  pinned?: boolean
}

// Helper to check if row is staged
const isStaged = (status: RowStatus) =>
  status === 'staged-delete' || status === 'staged-update' || status === 'staged-insert'

// Helper to update a single row in displayRows
const updateRow = (rows: DisplayRow[], idx: number, update: Partial<DisplayRow>): DisplayRow[] =>
  rows.map((row, i) => i === idx ? { ...row, ...update } : row)

interface QueryResultsProps {
  resultTabs: ResultTab[]
  activeResultTabId: string | null
  onResultTabChange: (resultTabId: string) => void
  isExecuting: boolean
  isCancelling?: boolean
  executingPid?: number | null
  onCancelQuery?: () => void
  connectionId: string
  onRefreshQuery?: (sql: string) => void
}

const ROW_HEIGHT = 28
const ROWS_PER_PAGE = 10000
const HEADER_ROW_HEIGHT = 29 // sticky header height including border

// Font specifications for text measurement
const HEADER_FONT = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CELL_FONT = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

// Measure text width using canvas
let measurementCanvas: HTMLCanvasElement | null = null
function measureText(text: string, font: string): number {
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas')
  }
  const context = measurementCanvas.getContext('2d')!
  context.font = font
  return context.measureText(text).width
}

// Highlight matching text in a string
const HighlightedText = memo(function HighlightedText({
  text,
  filter,
}: {
  text: string
  filter: string
}) {
  if (!filter) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerFilter = filter.toLowerCase()
  const parts: { text: string; highlight: boolean }[] = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerFilter)

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false })
    }
    parts.push({ text: text.slice(index, index + filter.length), highlight: true })
    lastIndex = index + filter.length
    index = lowerText.indexOf(lowerFilter, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false })
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-200 rounded-sm">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
})

// Generate page numbers to display
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = []

  // Always show first page
  pages.push(1)

  if (currentPage <= 3) {
    // Near start: 1, 2, 3, 4, ..., last
    pages.push(2, 3, 4, 'ellipsis', totalPages)
  } else if (currentPage >= totalPages - 2) {
    // Near end: 1, ..., last-3, last-2, last-1, last
    pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  } else {
    // Middle: 1, ..., curr-1, curr, curr+1, ..., last
    pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
  }

  return pages
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <div className="flex items-center gap-0.5">
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      {/* Page numbers */}
      {pageNumbers.map((page, idx) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
            <MoreHorizontal className="w-3 h-3" />
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[20px] h-5 px-1 rounded text-xs font-medium transition-colors ${
              page === currentPage
                ? 'bg-white border border-blue-500 text-blue-600'
                : 'text-gray-600 hover:bg-accent'
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}

interface ResultContentProps {
  result: QueryResult
  filter: string
  allDisplayRows: DisplayRow[]
  displayRows: DisplayRow[]
  selectedRowIndex: number | null
  onRowClick: (rowIndex: number, row: Record<string, unknown>, column?: string) => void
  onRowDoubleClick: (rowIndex: number, row: Record<string, unknown>, column: string) => void
  onExpandJson: (value: unknown, columnName: string, rowIndex: number) => void
  selectedIndices: Set<number>
  onRowSelect: (rowIndex: number, event: React.MouseEvent) => void
  onDeleteRows: (indices: number[]) => void
  onDuplicateRows: (indices: number[]) => void
  onDiscardRows: (indices: number[]) => void
  onPinRows: (indices: number[]) => void
  onUnpinRows: (indices: number[]) => void
  onRowHover: (rowIndex: number | null) => void
  hasWrite: boolean
  isExplainResult: boolean
}

function ResultContent({ result, filter, allDisplayRows, displayRows, selectedRowIndex, onRowClick, onRowDoubleClick, onExpandJson, selectedIndices, onRowSelect, onDeleteRows, onDuplicateRows, onDiscardRows, onPinRows, onUnpinRows, onRowHover, hasWrite, isExplainResult }: ResultContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; rowStatus: RowStatus } | null>(null)

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent, rowIndex: number, rowStatus: RowStatus) => {
    e.preventDefault()
    if (isExplainResult) return

    if (!selectedIndices.has(rowIndex)) {
      onRowSelect(rowIndex, e)
    }
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, rowStatus })
  }, [selectedIndices, onRowSelect, isExplainResult])

  const handleDeleteFromContextMenu = useCallback(() => {
    if (selectedIndices.size > 0) {
      onDeleteRows(Array.from(selectedIndices))
    }
    setContextMenu(null)
  }, [selectedIndices, onDeleteRows])

  const handleDuplicateFromContextMenu = useCallback(() => {
    if (selectedIndices.size > 0) {
      onDuplicateRows(Array.from(selectedIndices))
    }
    setContextMenu(null)
  }, [selectedIndices, onDuplicateRows])

  const handleDiscardFromContextMenu = useCallback(() => {
    if (selectedIndices.size > 0) {
      onDiscardRows(Array.from(selectedIndices))
    }
    setContextMenu(null)
  }, [selectedIndices, onDiscardRows])

  const handlePinFromContextMenu = useCallback(() => {
    if (selectedIndices.size > 0) {
      onPinRows(Array.from(selectedIndices))
    }
    setContextMenu(null)
  }, [selectedIndices, onPinRows])

  const handleUnpinFromContextMenu = useCallback(() => {
    if (selectedIndices.size > 0) {
      onUnpinRows(Array.from(selectedIndices))
    }
    setContextMenu(null)
  }, [selectedIndices, onUnpinRows])

  // Collect pinned rows from the full (unfiltered) set for the sticky section
  const pinnedItems = useMemo(() => {
    const pinned: { row: DisplayRow; pos: number }[] = []
    allDisplayRows.forEach((row, idx) => {
      if (row.pinned) {
        pinned.push({ row, pos: idx })
      }
    })
    return pinned
  }, [allDisplayRows])

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(displayRows.length / ROWS_PER_PAGE))

  // Reset to page 1 when filter changes or when current page exceeds total
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [displayRows.length, totalPages, currentPage])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  // Get rows for current page
  const pageStartIndex = (currentPage - 1) * ROWS_PER_PAGE
  const paginatedRows = useMemo(() => {
    return displayRows.slice(pageStartIndex, pageStartIndex + ROWS_PER_PAGE)
  }, [displayRows, pageStartIndex])

  const virtualizer = useVirtualizer({
    count: paginatedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  // Scroll to top when page changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [currentPage])

  // Calculate adaptive column widths based on header and content
  // Must be called before early returns to follow React's rules of hooks
  const columnWidths = useMemo(() => {
    const PADDING = 22
    const MIN = 80
    const MAX = 400

    return result.columns.map((col) => {
      // Header: 1.2x multiplier for canvas vs browser font rendering differences
      const headerWidth = Math.ceil(measureText(col.name, HEADER_FONT) * 1.2) + PADDING

      // Content: sample first 200 rows
      let contentWidth = 0
      for (const row of result.rows.slice(0, 200)) {
        const value = row[col.name]
        if (value !== null) {
          contentWidth = Math.max(contentWidth, measureText(String(value), CELL_FONT))
        }
      }
      contentWidth += PADDING

      return Math.min(Math.max(headerWidth, contentWidth, MIN), MAX)
    })
  }, [result.rows, result.columns])

  // Build grid template columns string
  const gridTemplateColumns = columnWidths.map(w => `${w}px`).join(' ')

  // Calculate total grid width to fix background rendering on scroll
  const totalGridWidth = columnWidths.reduce((sum, w) => sum + w, 0)

  const normalRowCount = displayRows.filter(r => r.status === 'normal').length
  const isFiltered = filter && normalRowCount !== result.rows.length

  // Early return for error case - must be after all hooks
  if (result.error) {
    const time = result.executionTime >= 1000
      ? `${(result.executionTime / 1000).toFixed(1)}s`
      : `${result.executionTime}ms`
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 p-4 overflow-auto">
          <div className="text-sm text-red-600 whitespace-pre-wrap">
            {result.error}
          </div>
        </div>
        <div className="h-8 px-3 flex items-center text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
          Executed in {time}
        </div>
      </div>
    )
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Scroll container with sticky header */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Sticky header row */}
        <div
          className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50"
          style={{ display: 'grid', gridTemplateColumns: `${gridTemplateColumns} 1fr`, minWidth: totalGridWidth }}
        >
          {result.columns.map((col) => (
            <Tooltip key={col.name}>
              <TooltipTrigger
                className="w-full px-2 py-1.5 text-xs font-medium text-gray-700 truncate border-r border-gray-200 last:border-r-0 text-left"
              >
                {col.name}
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                <span>{col.type || 'unknown'}</span>
              </TooltipContent>
            </Tooltip>
          ))}
          {/* Filler cell for remaining header width */}
          <div />
        </div>

        {/* Pinned rows - sticky below header, duplicated from main grid */}
        {pinnedItems.length > 0 && (
          <div
            className="sticky z-[9] border-b border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-1"
            style={{ top: HEADER_ROW_HEIGHT }}
          >
            {pinnedItems.map(({ row: pinnedRow, pos }) => {
              const globalRowIndex = pos + 1
              const { data, status, originalData } = pinnedRow
              const isSelected = selectedIndices.has(globalRowIndex) || selectedRowIndex === globalRowIndex
              const isStagedInsert = status === 'staged-insert'

              const rowClassName = `group border-b border-gray-100 select-none ${
                isStagedInsert
                  ? 'bg-green-100'
                  : status === 'staged-delete'
                    ? 'bg-red-100 text-gray-400'
                    : status === 'staged-update'
                      ? 'bg-amber-100'
                      : isSelected
                        ? 'bg-blue-50'
                        : 'bg-white hover:bg-gray-50'
              }`

              return (
                <div
                  key={globalRowIndex}
                  className={rowClassName}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    display: 'grid',
                    gridTemplateColumns: `${gridTemplateColumns} 1fr`,
                    minWidth: totalGridWidth,
                  }}
                  onContextMenu={(e) => handleContextMenu(e, globalRowIndex, status)}
                  onMouseEnter={() => onRowHover(globalRowIndex)}
                  onMouseLeave={() => onRowHover(null)}
                >
                  {result.columns.map((col) => {
                    const isJson = isJsonType(col.type)
                    const cellValue = data[col.name]
                    const isOverridden = status === 'staged-update' && originalData && originalData[col.name] !== cellValue
                    const isDefaultValue = isStagedInsert && cellValue === undefined
                    return (
                      <div
                        key={col.name}
                        className={`group/cell relative px-2 flex items-center text-xs truncate border-r border-gray-100 last:border-r-0 cursor-pointer ${isOverridden ? 'font-medium' : ''}`}
                        onClick={(e) => {
                          onRowSelect(globalRowIndex, e)
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                            onRowClick(globalRowIndex, data, col.name)
                          }
                        }}
                        onDoubleClick={() => {
                          onRowDoubleClick(globalRowIndex, data, col.name)
                        }}
                      >
                        {isDefaultValue ? (
                          <span className="text-gray-400 italic">DEFAULT</span>
                        ) : cellValue === null ? (
                          <span className="text-gray-400 italic">null</span>
                        ) : cellValue === '' ? (
                          <span className="text-gray-300 italic">(empty)</span>
                        ) : (
                          <HighlightedText text={String(cellValue)} filter={filter} />
                        )}
                        {isJson && cellValue !== null && cellValue !== undefined && (
                          <button
                            className="absolute right-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 shadow-sm opacity-0 group-hover/cell:opacity-100 hover:bg-gray-50 transition-opacity flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              onExpandJson(cellValue, col.name, globalRowIndex)
                            }}
                            title="Expand JSON"
                          >
                            <Expand className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">Expand</span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {/* Filler cell with pin indicator */}
                  <div
                    className="cursor-pointer flex items-center justify-end pr-2"
                    onClick={(e) => {
                      onRowSelect(globalRowIndex, e)
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                        onRowClick(globalRowIndex, data, undefined)
                      }
                    }}
                  >
                    <Pin className="w-3 h-3 text-blue-400" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Virtualized body */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            minWidth: totalGridWidth,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const displayRow = paginatedRows[virtualRow.index]
            const globalRowIndex = pageStartIndex + virtualRow.index + 1
            const { data, status, originalData } = displayRow
            const isSelected = selectedIndices.has(globalRowIndex) || selectedRowIndex === globalRowIndex
            const isStagedInsert = status === 'staged-insert'

            const rowClassName = `group absolute top-0 left-0 w-full border-b border-gray-100 select-none ${
              isStagedInsert
                ? 'bg-green-100'
                : status === 'staged-delete'
                  ? 'bg-red-100 text-gray-400'
                  : status === 'staged-update'
                    ? 'bg-amber-100'
                    : isSelected
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
            }`

            return (
              <div
                key={virtualRow.index}
                className={rowClassName}
                style={{
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `${gridTemplateColumns} 1fr`,
                }}
                onContextMenu={(e) => handleContextMenu(e, globalRowIndex, status)}
                onMouseEnter={() => onRowHover(globalRowIndex)}
                onMouseLeave={() => onRowHover(null)}
              >
                {result.columns.map((col) => {
                  const isJson = isJsonType(col.type)
                  const cellValue = data[col.name]
                  const isOverridden = status === 'staged-update' && originalData && originalData[col.name] !== cellValue
                  const isDefaultValue = isStagedInsert && cellValue === undefined
                  return (
                    <div
                      key={col.name}
                      className={`group/cell relative px-2 flex items-center text-xs truncate border-r border-gray-100 last:border-r-0 cursor-pointer ${isOverridden ? 'font-medium' : ''}`}
                      onClick={(e) => {
                        onRowSelect(globalRowIndex, e)
                        // Regular click also opens detail panel
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                          onRowClick(globalRowIndex, data, col.name)
                        }
                      }}
                      onDoubleClick={() => {
                        onRowDoubleClick(globalRowIndex, data, col.name)
                      }}
                    >
                      {isDefaultValue ? (
                        <span className="text-gray-400 italic">DEFAULT</span>
                      ) : cellValue === null ? (
                        <span className="text-gray-400 italic">null</span>
                      ) : cellValue === '' ? (
                        <span className="text-gray-300 italic">(empty)</span>
                      ) : (
                        <HighlightedText text={String(cellValue)} filter={filter} />
                      )}
                      {isJson && cellValue !== null && cellValue !== undefined && (
                        <button
                          className="absolute right-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 shadow-sm opacity-0 group-hover/cell:opacity-100 hover:bg-gray-50 transition-opacity flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            onExpandJson(cellValue, col.name, globalRowIndex)
                          }}
                          title="Expand JSON"
                        >
                          <Expand className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">Expand</span>
                        </button>
                      )}
                    </div>
                  )
                })}
                {/* Filler cell for remaining row width - makes entire row clickable */}
                <div
                  className="cursor-pointer"
                  onClick={(e) => {
                    onRowSelect(globalRowIndex, e)
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                      onRowClick(globalRowIndex, data, undefined)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer: Status bar with pagination */}
      <div className="shrink-0 h-6 px-2 flex items-center justify-between border-t border-gray-200 bg-gray-50">
        {/* Left: Execution time */}
        <div className="text-xs text-gray-500">
          Executed in {result.executionTime >= 1000
            ? `${(result.executionTime / 1000).toFixed(1)}s`
            : `${result.executionTime}ms`}
        </div>

        {/* Right: Row count + Pagination */}
        <div className="flex items-center gap-3">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
          <span className="text-xs text-gray-500">
            {pinnedItems.length > 0 && `${pinnedItems.length} pinned · `}
            {isFiltered
              ? `${normalRowCount.toLocaleString()} of ${result.rows.length.toLocaleString()} rows`
              : `${displayRows.length.toLocaleString()} rows`}
          </span>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* Pin/Unpin option */}
          {allDisplayRows[contextMenu.rowIndex - 1]?.pinned ? (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center"
              onClick={handleUnpinFromContextMenu}
            >
              <span className="flex-1">Unpin {selectedIndices.size > 1 ? `${selectedIndices.size} rows` : 'row'}</span>
              <span className="text-xs text-gray-400 ml-3">Space</span>
            </button>
          ) : (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center"
              onClick={handlePinFromContextMenu}
            >
              <span className="flex-1">Pin {selectedIndices.size > 1 ? `${selectedIndices.size} rows` : 'row'}</span>
              <span className="text-xs text-gray-400 ml-3">Space</span>
            </button>
          )}

          {/* Duplicate option - only for single normal rows with write permission */}
          {hasWrite && selectedIndices.size === 1 && contextMenu.rowStatus === 'normal' && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={handleDuplicateFromContextMenu}
            >
              Duplicate row
            </button>
          )}

          {/* Delete option - only for normal rows with write permission */}
          {hasWrite && contextMenu.rowStatus === 'normal' && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={handleDeleteFromContextMenu}
            >
              Delete {selectedIndices.size > 1 ? `${selectedIndices.size} rows` : 'row'}
            </button>
          )}

          {/* Discard option - only for staged rows (user already had write permission to stage) */}
          {contextMenu.rowStatus !== 'normal' && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 text-amber-600"
              onClick={handleDiscardFromContextMenu}
            >
              Discard {selectedIndices.size > 1 ? `${selectedIndices.size} changes` : 'change'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function QueryResults({
  resultTabs,
  activeResultTabId,
  onResultTabChange,
  isExecuting,
  isCancelling,
  executingPid,
  onCancelQuery,
  connectionId,
  onRefreshQuery,
}: QueryResultsProps) {
  const { hasWrite, hasExport } = useConnectionPermissions(connectionId)
  const [filterInput, setFilterInput] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedRow, setSelectedRow] = useState<{
    index: number
    data: Record<string, unknown>
    column?: string
  } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [jsonModal, setJsonModal] = useState<{
    value: unknown
    columnName: string
    rowIndex: number
  } | null>(null)
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const [isEditingRow, setIsEditingRow] = useState(false)
  const [autoEditColumn, setAutoEditColumn] = useState<string | null>(null)
  const [displayRowsMap, setDisplayRowsMap] = useState<Record<string, DisplayRow[]>>({})
  const [pendingNewRow, setPendingNewRow] = useState<Record<string, unknown> | null>(null)

  // Per-tab display rows: derive current tab's rows from the map
  const activeTabIdRef = useRef(activeResultTabId)
  activeTabIdRef.current = activeResultTabId
  const displayRows = activeResultTabId ? (displayRowsMap[activeResultTabId] ?? []) : []
  const setDisplayRows = useCallback((updater: DisplayRow[] | ((prev: DisplayRow[]) => DisplayRow[])) => {
    const tabId = activeTabIdRef.current
    if (!tabId) return
    setDisplayRowsMap(prev => {
      const current = prev[tabId] ?? []
      const next = typeof updater === 'function' ? updater(current) : updater
      return { ...prev, [tabId]: next }
    })
  }, [])

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filterInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [filterInput])

  // Track previous selected row index to detect row changes
  const prevSelectedIndexRef = useRef<number | null>(null)

  // Clear UI state when active result changes (but not displayRows — those are per-tab)
  useEffect(() => {
    setSelectedRow(null)
    setDrawerOpen(false)
    setIsEditingRow(false)
    setAutoEditColumn(null)
    setPendingNewRow(null)
    prevSelectedIndexRef.current = null
  }, [activeResultTabId])

  // Exit edit mode when switching to a different row (but not for pending new rows)
  useEffect(() => {
    const currentIndex = selectedRow?.index ?? null
    const prevIndex = prevSelectedIndexRef.current

    // If row index changed and we were on a different row before, exit edit mode
    // But skip this for pending new rows (add/duplicate) which should stay in edit mode
    if (prevIndex !== null && currentIndex !== null && prevIndex !== currentIndex && !pendingNewRow) {
      setIsEditingRow(false)
      setAutoEditColumn(null)
    }

    prevSelectedIndexRef.current = currentIndex
  }, [selectedRow?.index, pendingNewRow])

  // Space key to toggle pin on selected or hovered row
  useKeyboardShortcut(
    'toggle-row-pin',
    ' ',
    () => {
      const targetIndex = selectedRow?.index ?? hoveredRowIndex
      if (targetIndex === null) return
      const row = displayRows[targetIndex - 1]
      if (!row) return
      if (row.pinned) {
        handleUnpinRows([targetIndex])
      } else {
        handlePinRows([targetIndex])
      }
    },
    { when: () => (selectedRow !== null || hoveredRowIndex !== null) && !isEditingRow }
  )

  useEffect(() => {
    if (!isExecuting) {
      setElapsedTime(0)
      return
    }

    // Stop updating when cancelling
    if (isCancelling) {
      return
    }

    const startTime = Date.now() - elapsedTime * 1000 // Preserve current elapsed time
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000)
    }, 100)

    return () => clearInterval(interval)
  }, [isExecuting, isCancelling])

  const activeResult = resultTabs.find((rt) => rt.id === activeResultTabId)

  // Check if this is an EXPLAIN result (read-only, no row interaction)
  const isExplainResult = useMemo(() => {
    if (!activeResult?.sql) return false
    const trimmed = activeResult.sql.trim().toUpperCase()
    return trimmed.startsWith('EXPLAIN')
  }, [activeResult?.sql])

  // Initialize displayRows for new result tabs (preserves existing tabs' state)
  useEffect(() => {
    if (!activeResult) return
    setDisplayRowsMap(prev => {
      if (prev[activeResult.id]) return prev // Already initialized
      const rows: DisplayRow[] = activeResult.result.rows.map(row => ({
        data: row,
        status: 'normal' as RowStatus,
      }))
      return { ...prev, [activeResult.id]: rows }
    })
  }, [activeResult?.id]) // Only run when result tab changes

  // Clean up displayRowsMap entries for removed result tabs
  useEffect(() => {
    const tabIds = new Set(resultTabs.map(rt => rt.id))
    setDisplayRowsMap(prev => {
      const stale = Object.keys(prev).filter(k => !tabIds.has(k))
      if (stale.length === 0) return prev
      const next = { ...prev }
      for (const k of stale) delete next[k]
      return next
    })
  }, [resultTabs])

  // Apply text filter to displayRows (filter does not apply to the pinned area)
  const filteredDisplayRows = useMemo(() => {
    if (!debouncedFilter || !activeResult) return displayRows
    const lowerFilter = debouncedFilter.toLowerCase()
    return displayRows.filter((displayRow) =>
      activeResult.result.columns.some((col) => {
        const value = displayRow.data[col.name]
        if (value === null) return false
        return String(value).toLowerCase().includes(lowerFilter)
      })
    )
  }, [displayRows, debouncedFilter, activeResult])

  // Staged changes modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const executeSQL = useExecuteSQL()

  // Compute staged changes from displayRows for SQL generation
  const stagedChanges = useMemo((): StagedChange[] => {
    if (!activeResult) return []
    const columns = activeResult.result.columns
    const changes: StagedChange[] = []

    // Group by change type
    const deletes: { row: Record<string, unknown>; index: number }[] = []
    const updates: { row: Record<string, unknown>; original: Record<string, unknown>; index: number }[] = []
    const inserts: { row: Record<string, unknown> }[] = []

    displayRows.forEach((displayRow, idx) => {
      if (displayRow.status === 'staged-delete') {
        deletes.push({ row: displayRow.data, index: idx + 1 })
      } else if (displayRow.status === 'staged-update' && displayRow.originalData) {
        updates.push({ row: displayRow.data, original: displayRow.originalData, index: idx + 1 })
      } else if (displayRow.status === 'staged-insert') {
        inserts.push({ row: displayRow.data })
      }
    })

    // Create delete change
    if (deletes.length > 0) {
      const tableName = columns[0]?.tableName || ''
      const schemaName = columns[0]?.schemaName || ''
      const pkColumns = columns.filter(c => c.isPrimaryKey)
      changes.push({
        id: 'delete',
        type: 'delete',
        tables: [{
          tableName,
          schemaName,
          primaryKeyColumns: pkColumns.map(c => c.name),
          rows: deletes.map(d => {
            const pk: Record<string, unknown> = {}
            pkColumns.forEach(c => { pk[c.name] = d.row[c.name] })
            return pk
          }),
        }],
        rowCount: deletes.length,
        createdAt: new Date(),
        rowIndices: deletes.map(d => d.index),
      })
    }

    // Create update change
    if (updates.length > 0) {
      const tableName = columns[0]?.tableName || ''
      const schemaName = columns[0]?.schemaName || ''
      const pkColumns = columns.filter(c => c.isPrimaryKey)
      changes.push({
        id: 'update',
        type: 'update',
        tables: [{
          tableName,
          schemaName,
          primaryKeyColumns: pkColumns.map(c => c.name),
          rows: updates.map(u => {
            // Only include changed columns + primary keys for WHERE
            const changed: Record<string, unknown> = {}
            columns.forEach(c => {
              if (c.isPrimaryKey) {
                changed[c.name] = u.original[c.name] // Use original PK for WHERE
              } else if (u.row[c.name] !== u.original[c.name]) {
                changed[c.name] = u.row[c.name]
              }
            })
            return changed
          }),
        }],
        rowCount: updates.length,
        createdAt: new Date(),
        originalRows: updates.map(u => {
          const pk: Record<string, unknown> = {}
          pkColumns.forEach(c => { pk[c.name] = u.original[c.name] })
          return pk
        }),
        rowIndices: updates.map(u => u.index),
      })
    }

    // Create insert change
    if (inserts.length > 0) {
      const tableName = columns[0]?.tableName || ''
      const schemaName = columns[0]?.schemaName || ''
      changes.push({
        id: 'insert',
        type: 'insert',
        tables: [{
          tableName,
          schemaName,
          primaryKeyColumns: [],
          rows: inserts.map(i => i.row),
        }],
        rowCount: inserts.length,
        createdAt: new Date(),
      })
    }

    return changes
  }, [displayRows, activeResult])

  // Count total SQL statements
  const statementCount = useMemo(() => {
    return stagedChanges.reduce((count, change) => {
      let sql = ''
      if (change.type === 'delete') sql = generateDeleteSQL(change)
      else if (change.type === 'update') sql = generateUpdateSQL(change)
      else if (change.type === 'insert') sql = generateInsertSQL(change)
      return count + (sql.match(/;/g) || []).length
    }, 0)
  }, [stagedChanges])

  // Check if there are any staged changes
  const hasStagedChanges = displayRows.some(r => isStaged(r.status))

  // Row selection - define first with a ref to allow callback to call clearSelection
  const selectionRef = useRef<ReturnType<typeof useRowSelection> | null>(null)

  const handleDeleteSelection = useCallback((indices: number[]) => {
    const indexSet = new Set(indices.map(i => i - 1)) // Convert to 0-based
    setDisplayRows(prev => prev.map((row, idx) =>
      indexSet.has(idx) && row.status === 'normal' ? { ...row, status: 'staged-delete' as RowStatus } : row
    ))
    selectionRef.current?.clearSelection()
  }, [])

  const handleDiscardSelection = useCallback((indices: number[]) => {
    const indexSet = new Set(indices.map(i => i - 1)) // Convert to 0-based
    setDisplayRows(prev => prev
      .filter((row, idx) => {
        // Remove staged-insert rows
        if (indexSet.has(idx) && row.status === 'staged-insert') return false
        return true
      })
      .map((row, idx) => {
        if (!indexSet.has(idx)) return row
        // Revert staged-delete and staged-update rows
        if (row.status === 'staged-delete') return { ...row, status: 'normal' as RowStatus }
        if (row.status === 'staged-update') return { data: row.originalData!, status: 'normal' as RowStatus, pinned: row.pinned }
        return row
      })
    )
    selectionRef.current?.clearSelection()
  }, [])

  const handlePinRows = useCallback((indices: number[]) => {
    const indexSet = new Set(indices.map(i => i - 1))
    setDisplayRows(prev => prev.map((row, idx) =>
      indexSet.has(idx) ? { ...row, pinned: true } : row
    ))
    selectionRef.current?.clearSelection()
  }, [])

  const handleUnpinRows = useCallback((indices: number[]) => {
    const indexSet = new Set(indices.map(i => i - 1))
    setDisplayRows(prev => prev.map((row, idx) =>
      indexSet.has(idx) ? { ...row, pinned: false } : row
    ))
    selectionRef.current?.clearSelection()
  }, [])

  const handleSaveEdit = useCallback((updatedRow: Record<string, unknown>) => {
    if (!selectedRow) return

    // Handle pending new row (add or duplicate)
    if (pendingNewRow) {
      setDisplayRows(prev => [...prev, { data: updatedRow, status: 'staged-insert' }])
      setPendingNewRow(null)
      setSelectedRow(null)
      setDrawerOpen(false)
      setIsEditingRow(false)
      return
    }

    const idx = selectedRow.index - 1
    const row = displayRows[idx]
    if (!row) return

    const originalData = row.originalData || row.data
    setDisplayRows(prev => updateRow(prev, idx, { data: updatedRow, status: 'staged-update', originalData }))
    setIsEditingRow(false)
  }, [selectedRow, displayRows, pendingNewRow])

  const handleDuplicateSelection = useCallback((indices: number[]) => {
    if (!activeResult || indices.length !== 1) return
    const source = displayRows[indices[0] - 1]
    if (!source) return

    // Copy values, leave PK empty for user to fill (use DEFAULT if available)
    const newData: Record<string, unknown> = {}
    for (const col of activeResult.result.columns) {
      newData[col.name] = col.isPrimaryKey
        ? (col.hasDefault ? undefined : '')
        : source.data[col.name]
    }

    // Find first focusable column (PK columns have '' which renders an input)
    const firstFocusableCol = activeResult.result.columns.find(col => col.isPrimaryKey)
      ?? activeResult.result.columns[0]

    setPendingNewRow(newData)
    setSelectedRow({ index: displayRows.length + 1, data: newData })
    setDrawerOpen(true)
    setIsEditingRow(true)
    setAutoEditColumn(firstFocusableCol?.name ?? null)
    selectionRef.current?.clearSelection()
  }, [activeResult, displayRows])

  const handleAddRow = useCallback(() => {
    if (!activeResult) return

    // Create new row with defaults: undefined for columns with defaults, empty for PKs
    const newData: Record<string, unknown> = {}
    for (const col of activeResult.result.columns) {
      newData[col.name] = col.hasDefault ? undefined : (col.isPrimaryKey ? '' : null)
    }

    // Find first focusable column (one that won't render as "DEFAULT" div)
    // Columns with hasDefault get undefined value which renders as non-focusable div
    const firstFocusableCol = activeResult.result.columns.find(col => !col.hasDefault || col.isPrimaryKey)
      ?? activeResult.result.columns[0]

    setPendingNewRow(newData)
    setSelectedRow({ index: displayRows.length + 1, data: newData })
    setDrawerOpen(true)
    setIsEditingRow(true)
    setAutoEditColumn(firstFocusableCol?.name ?? null)
    selectionRef.current?.clearSelection()
  }, [activeResult, displayRows])

  const selection = useRowSelection({
    totalRows: displayRows.length,
    onDelete: hasWrite ? handleDeleteSelection : undefined,
  })

  // Keep ref updated
  selectionRef.current = selection

  // Row navigation: j/ArrowDown = next, k/ArrowUp = previous
  // When no row is selected, first keypress selects the hovered row
  const selectRowAt = useCallback((index: number) => {
    const row = displayRows[index - 1]
    if (!row) return
    setSelectedRow({ index, data: row.data })
    selection.handleRowClick(index, { shiftKey: false, metaKey: false, ctrlKey: false })
  }, [displayRows, selection])

  useKeyboardShortcut(
    'row-nav-prev',
    ['k', 'ArrowUp'],
    () => {
      if (selectedRow) {
        handlePreviousRow()
      } else if (hoveredRowIndex !== null) {
        selectRowAt(hoveredRowIndex)
      }
    },
    { when: () => (selectedRow !== null || hoveredRowIndex !== null) && !isEditingRow }
  )

  useKeyboardShortcut(
    'row-nav-next',
    ['j', 'ArrowDown'],
    () => {
      if (selectedRow) {
        handleNextRow()
      } else if (hoveredRowIndex !== null) {
        selectRowAt(hoveredRowIndex)
      }
    },
    { when: () => (selectedRow !== null || hoveredRowIndex !== null) && !isEditingRow }
  )

  // Execute all staged changes
  const handleExecuteAll = useCallback(async () => {
    const statements = stagedChanges
      .map(change =>
        change.type === 'delete' ? generateDeleteSQL(change)
        : change.type === 'update' ? generateUpdateSQL(change)
        : generateInsertSQL(change)
      )
      .filter(Boolean)

    if (statements.length === 0) return

    const sql = statements.join('\n')
    const result = await executeSQL.mutateAsync({ connectionId, sql })
    if (result.error) {
      throw new Error(result.error)
    }

    // Close the preview modal
    setPreviewModalOpen(false)

    // Refresh the query if we have the original SQL
    const activeResult = resultTabs.find((rt) => rt.id === activeResultTabId)
    if (activeResult?.sql && onRefreshQuery) {
      onRefreshQuery(activeResult.sql)
    }
  }, [stagedChanges, executeSQL, connectionId, resultTabs, activeResultTabId, onRefreshQuery])

  // Discard all staged changes
  const handleDiscardAll = useCallback(() => {
    setDisplayRows(prev => prev
      .filter(r => r.status !== 'staged-insert')
      .map(r => {
        if (r.status === 'staged-delete') return { data: r.data, status: 'normal' as RowStatus, pinned: r.pinned }
        if (r.status === 'staged-update') return { data: r.originalData!, status: 'normal' as RowStatus, pinned: r.pinned }
        return r
      })
    )
  }, [])

  const handleSaveJsonModal = useCallback((newValue: string) => {
    if (!jsonModal) return

    // Validate JSON and store as compact string for consistency with DB format
    let valueToStore: string
    try {
      const parsed = JSON.parse(newValue)
      // Store as compact JSON string (no extra whitespace)
      valueToStore = JSON.stringify(parsed)
    } catch {
      // If not valid JSON, store as-is
      valueToStore = newValue
    }

    // Handle pending new row
    if (pendingNewRow) {
      const updatedData = { ...pendingNewRow, [jsonModal.columnName]: valueToStore }
      setPendingNewRow(updatedData)
      if (selectedRow) {
        setSelectedRow({ ...selectedRow, data: updatedData })
      }
      return
    }

    const idx = jsonModal.rowIndex - 1
    const row = displayRows[idx]
    if (!row) return

    const updatedData = { ...row.data, [jsonModal.columnName]: valueToStore }

    if (row.status === 'staged-insert') {
      setDisplayRows(prev => updateRow(prev, idx, { data: updatedData }))
    } else {
      const originalData = row.originalData || row.data
      setDisplayRows(prev => updateRow(prev, idx, { data: updatedData, status: 'staged-update', originalData }))
    }

    // Update selectedRow data if it's the same row
    if (selectedRow?.index === jsonModal.rowIndex) {
      setSelectedRow({ ...selectedRow, data: updatedData })
    }
  }, [jsonModal, displayRows, selectedRow, pendingNewRow])

  const handleRowClick = useCallback((rowIndex: number, row: Record<string, unknown>, column?: string) => {
    // Don't open detail panel for EXPLAIN results
    if (isExplainResult) return
    setSelectedRow({ index: rowIndex, data: row, column })
    setDrawerOpen(true)
  }, [isExplainResult])

  const handleRowDoubleClick = useCallback((rowIndex: number, row: Record<string, unknown>, column: string) => {
    // Don't do anything for EXPLAIN results
    if (isExplainResult) return
    const displayRow = displayRows[rowIndex - 1]
    // Check if row is already staged or user lacks write permission - if so, don't auto-enter edit mode
    if (!hasWrite || (displayRow && displayRow.status !== 'normal')) {
      // Just open the panel normally, don't enter edit mode
      setSelectedRow({ index: rowIndex, data: row, column })
      setDrawerOpen(true)
      return
    }
    // Open panel, enter edit mode, and set column to focus
    setSelectedRow({ index: rowIndex, data: row, column })
    setDrawerOpen(true)
    setIsEditingRow(true)
    setAutoEditColumn(column)
  }, [displayRows, hasWrite, isExplainResult])

  const handleClosePanel = useCallback(() => {
    // If closing a pending new row, discard it
    if (pendingNewRow) {
      setPendingNewRow(null)
      setSelectedRow(null)
      setIsEditingRow(false)
      setAutoEditColumn(null)
    }
    setDrawerOpen(false)
  }, [pendingNewRow])

  const handleExpandJson = useCallback((value: unknown, columnName: string, rowIndex: number) => {
    setJsonModal({ value, columnName, rowIndex })
  }, [])

  const handleCloseJsonModal = useCallback(() => {
    setJsonModal(null)
  }, [])

  const handlePreviousRow = useCallback(() => {
    if (!selectedRow || selectedRow.index <= 1) return
    const newIndex = selectedRow.index - 1
    const newDisplayRow = displayRows[newIndex - 1]
    if (newDisplayRow) {
      setSelectedRow({ index: newIndex, data: newDisplayRow.data })
      selection.handleRowClick(newIndex, { shiftKey: false, metaKey: false, ctrlKey: false })
    }
  }, [selectedRow, displayRows, selection])

  const handleNextRow = useCallback(() => {
    if (!selectedRow || selectedRow.index >= displayRows.length) return
    const newIndex = selectedRow.index + 1
    const newDisplayRow = displayRows[newIndex - 1]
    if (newDisplayRow) {
      setSelectedRow({ index: newIndex, data: newDisplayRow.data })
      selection.handleRowClick(newIndex, { shiftKey: false, metaKey: false, ctrlKey: false })
    }
  }, [selectedRow, displayRows, selection])

  const handleCopyAsMarkdown = useCallback(async () => {
    if (!activeResult) return

    const { columns } = activeResult.result
    const columnNames = columns.map((col) => col.name)

    // Build markdown table
    const lines: string[] = []

    // Header row
    lines.push(`| ${columnNames.join(' | ')} |`)

    // Separator row
    lines.push(`| ${columnNames.map(() => '---').join(' | ')} |`)

    // Data rows (only normal rows, not staged)
    for (const displayRow of displayRows) {
      if (displayRow.status !== 'normal') continue
      const cells = columnNames.map((colName) => {
        const value = displayRow.data[colName]
        if (value === null) return 'null'
        return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
      })
      lines.push(`| ${cells.join(' | ')} |`)
    }

    await navigator.clipboard.writeText(lines.join('\n'))
  }, [activeResult, displayRows])

  const handleExport = useCallback(() => {
    if (!activeResult) return

    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, (m) => (m === 'T' ? '-' : ''))
    const filename = `export-${timestamp}.csv`

    const rows = displayRows.filter(r => r.status === 'normal').map(r => r.data)
    exportToCsv(activeResult.result.columns, rows, filename)

    queryClient.auditExport({
      connectionId,
      sql: activeResult.sql || '',
      rowCount: rows.length,
      format: 'csv',
    }).catch(() => {})
  }, [activeResult, displayRows, connectionId])

  // Only show "Executing query..." if there are no results yet
  // If results exist, show them even if isExecuting is true (avoids timing issues)
  if (isExecuting && resultTabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="text-sm text-gray-500">
          Executing query...{elapsedTime >= 1 && ` (${elapsedTime.toFixed(1)}s)`}
          {executingPid && <span className="ml-2 text-gray-400">PID {executingPid}</span>}
        </div>
        {elapsedTime >= 1 && onCancelQuery && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancelQuery}
            disabled={isCancelling}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <X className="w-3 h-3 mr-1" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}
      </div>
    )
  }

  if (!isExecuting && resultTabs.length === 0) {
    const isMac = navigator.platform.includes('Mac')
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400">
        Run a query to see results ({isMac ? '⌘' : 'Ctrl'} + Enter)
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Staged changes buttons - above tabs */}
      {hasStagedChanges && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/50 text-xs">
          <button
            className="px-2 py-1 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 rounded shadow-sm"
            onClick={handleDiscardAll}
          >
            Discard
          </button>
          <button
            className="px-2 py-1 text-primary-foreground bg-primary hover:bg-primary/80 rounded shadow-sm flex items-center gap-1.5"
            onClick={() => setPreviewModalOpen(true)}
          >
            Preview changes
            <span className="px-1.5 py-0.5 bg-primary-foreground/20 text-primary-foreground rounded-full text-xs font-medium">
              {statementCount}
            </span>
          </button>
        </div>
      )}
      <div className="shrink-0 flex items-center border-b border-gray-200 bg-gray-50 py-1">
        <TabBar
          tabs={resultTabs.map((rt) => ({
            id: rt.id,
            label: rt.title,
            className: rt.result.error ? 'text-red-500' : undefined,
          }))}
          activeTabId={activeResultTabId}
          onTabSelect={onResultTabChange}
          className="flex-1 min-w-0"
        />
        <div className="shrink-0 px-2 flex items-center">
          <SearchInput
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onClear={() => setFilterInput('')}
            size="sm"
            className="w-40 mr-2"
          />
          {hasWrite && !isExplainResult && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleAddRow}
              disabled={!activeResult || !!activeResult.result.error}
              title="Add row"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopyAsMarkdown}
            disabled={!activeResult || !!activeResult.result.error || activeResult.result.rows.length === 0}
            title="Copy as Markdown table"
          >
            <Clipboard className="w-4 h-4" />
          </Button>
          {hasExport && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleExport}
              disabled={!activeResult || !!activeResult.result.error || activeResult.result.rows.length === 0}
              title="Export to CSV"
            >
              <Download className="w-4 h-4 mr-1" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {activeResult && (
          <ResultContent
            result={activeResult.result}
            filter={debouncedFilter}
            allDisplayRows={displayRows}
            displayRows={filteredDisplayRows}
            selectedRowIndex={selectedRow?.index ?? null}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            onExpandJson={handleExpandJson}
            selectedIndices={selection.selectedIndices}
            onRowSelect={(index, event) => {
              const isToggle = event.metaKey || event.ctrlKey

              if (isToggle) {
                // Cmd/Ctrl+click: toggle behavior
                const wasSelected = selection.selectedIndices.has(index)
                const isInDetailPanel = selectedRow?.index === index

                if (wasSelected || isInDetailPanel) {
                  // Close detail panel if showing this row
                  if (isInDetailPanel) {
                    setSelectedRow(null)
                    setDrawerOpen(false)
                  }
                  // Remove from selection if it was selected
                  if (wasSelected) {
                    selection.handleRowClick(index, event)
                  }
                } else {
                  // Add to selection
                  selection.handleRowClick(index, event)
                }
              } else {
                // Regular click or shift+click: let useRowSelection handle it
                selection.handleRowClick(index, event)
              }
            }}
            onDeleteRows={handleDeleteSelection}
            onDuplicateRows={handleDuplicateSelection}
            onDiscardRows={handleDiscardSelection}
            onPinRows={handlePinRows}
            onUnpinRows={handleUnpinRows}
            onRowHover={setHoveredRowIndex}
            hasWrite={hasWrite}
            isExplainResult={isExplainResult}
          />
        )}
      </div>
      {selectedRow && activeResult && !isExplainResult && (() => {
        // Handle pending new row (add or duplicate)
        if (pendingNewRow) {
          return (
            <RowDetailPanel
              row={selectedRow.data}
              columns={activeResult.result.columns}
              open={drawerOpen}
              onClose={handleClosePanel}
              onPrevious={() => {}}
              onNext={() => {}}
              hasPrevious={false}
              hasNext={false}
              scrollToColumn={selectedRow.column}
              currentIndex={selectedRow.index}
              totalCount={displayRows.length + 1}
              onExpandJson={(value, columnName) => handleExpandJson(value, columnName, selectedRow.index)}
              onEdit={undefined}
              isEditing={isEditingRow}
              onCancelEdit={handleClosePanel}
              onSaveEdit={handleSaveEdit}
              autoEditColumn={autoEditColumn}
              onAutoEditHandled={() => setAutoEditColumn(null)}
              onDelete={undefined}
              stagedType={undefined}
              stagedOverrides={undefined}
              onDiscardStaged={undefined}
              isNewRow={true}
            />
          )
        }

        const displayRow = displayRows[selectedRow.index - 1]
        if (!displayRow) return null

        const { status, originalData } = displayRow
        const isStagedInsert = status === 'staged-insert'

        // Map status to stagedType for RowDetailPanel
        const stagedType = status === 'staged-delete' ? 'delete'
          : status === 'staged-update' ? 'update'
          : status === 'staged-insert' ? 'insert'
          : undefined

        // Compute staged overrides for update rows
        const stagedOverrides = status === 'staged-update' && originalData
          ? Object.fromEntries(
              Object.entries(displayRow.data).filter(([key, val]) => originalData[key] !== val)
            )
          : undefined

        return (
          <RowDetailPanel
            row={displayRow.data}
            columns={activeResult.result.columns}
            open={drawerOpen}
            onClose={handleClosePanel}
            onPrevious={handlePreviousRow}
            onNext={handleNextRow}
            hasPrevious={selectedRow.index > 1}
            hasNext={selectedRow.index < displayRows.length}
            scrollToColumn={selectedRow.column}
            currentIndex={selectedRow.index}
            totalCount={displayRows.length}
            onExpandJson={(value, columnName) => handleExpandJson(value, columnName, selectedRow.index)}
            onEdit={hasWrite && !isStagedInsert ? () => setIsEditingRow(true) : undefined}
            isEditing={isEditingRow}
            onCancelEdit={() => {
              setIsEditingRow(false)
              setAutoEditColumn(null)
            }}
            onSaveEdit={handleSaveEdit}
            autoEditColumn={autoEditColumn}
            onAutoEditHandled={() => setAutoEditColumn(null)}
            onDelete={hasWrite && !isStagedInsert ? () => handleDeleteSelection([selectedRow.index]) : undefined}
            stagedType={stagedType}
            stagedOverrides={stagedOverrides}
            onDiscardStaged={() => {
              const idx = selectedRow.index - 1
              if (status === 'staged-insert') {
                setDisplayRows(prev => prev.filter((_, i) => i !== idx))
                setSelectedRow(null)
                setDrawerOpen(false)
              } else if (status === 'staged-delete') {
                setDisplayRows(prev => updateRow(prev, idx, { status: 'normal' }))
              } else if (status === 'staged-update') {
                setDisplayRows(prev => updateRow(prev, idx, { data: originalData!, status: 'normal' }))
              }
            }}
            isNewRow={false}
          />
        )
      })()}
      {jsonModal && (
        <JsonExpandModal
          open={true}
          onClose={handleCloseJsonModal}
          value={jsonModal.value}
          columnName={jsonModal.columnName}
          onSave={hasWrite && !isExplainResult ? handleSaveJsonModal : undefined}
        />
      )}
      <StagedChangesModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        connectionId={connectionId}
        stagedChanges={stagedChanges}
        onExecuteAll={handleExecuteAll}
      />
    </div>
  )
}

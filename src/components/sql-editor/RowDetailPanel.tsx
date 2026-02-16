import { Copy, Check, X, ChevronUp, ChevronDown, Expand, Trash2, Pencil, Undo2 } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { SearchInput } from '../ui/search-input'
import { JsonViewer } from './JsonViewer'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'
import type { ColumnMetadata } from './hooks/useEditorTabs'

interface RowDetailPanelProps {
  row: Record<string, unknown>
  columns: ColumnMetadata[]
  open: boolean
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  hasPrevious: boolean
  hasNext: boolean
  scrollToColumn?: string
  currentIndex: number
  totalCount: number
  onExpandJson?: (value: unknown, columnName: string) => void
  onEdit?: () => void
  isEditing?: boolean
  onCancelEdit?: () => void
  onSaveEdit?: (updatedRow: Record<string, unknown>) => void
  onDelete?: () => void
  stagedType?: 'delete' | 'update' | 'insert'
  stagedOverrides?: Record<string, unknown>
  onDiscardStaged?: () => void
  autoEditColumn?: string | null
  onAutoEditHandled?: () => void
  isNewRow?: boolean
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-accent text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

function isJsonType(type: string): boolean {
  return type === 'json' || type === 'jsonb'
}

function HighlightedText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerSearch = search.toLowerCase()
  const parts: { text: string; highlight: boolean }[] = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerSearch)

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false })
    }
    parts.push({ text: text.slice(index, index + search.length), highlight: true })
    lastIndex = index + search.length
    index = lowerText.indexOf(lowerSearch, lastIndex)
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
}

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (isJsonType(type)) {
    try {
      // Try to parse and pretty-print JSON
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

const valueBaseStyles = "w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded"

function ValueRenderer({ value, search, isJson, isStaged }: { value: string; search: string; isJson: boolean; isStaged?: boolean }) {
  const isMultiline = value.includes('\n') || value.length > 50
  const stagedStyles = isStaged ? 'bg-amber-50 border-amber-200' : ''

  if (isJson && !search) {
    return (
      <div className={`${valueBaseStyles} ${stagedStyles} min-h-[80px] max-h-64 overflow-auto`}>
        <JsonViewer value={value} />
      </div>
    )
  }

  return (
    <div className={`${valueBaseStyles} ${stagedStyles} ${isMultiline ? 'min-h-[80px] max-h-64 overflow-auto whitespace-pre-wrap break-words' : 'min-h-[28px] truncate'}`}>
      <HighlightedText text={value} search={search} />
    </div>
  )
}

function EditableField({
  value,
  colType,
  isNullable,
  hasDefault,
  isNewRow,
  onChange,
  onSetNull,
  onSetDefault,
  autoFocus,
}: {
  value: unknown
  colType: string
  isNullable: boolean
  hasDefault: boolean
  isNewRow: boolean
  onChange: (value: string) => void
  onSetNull: () => void
  onSetDefault: () => void
  autoFocus?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  const isNull = value === null
  const isDefault = value === undefined
  const isJson = isJsonType(colType)
  const isBool = colType === 'boolean' || colType === 'bool'

  // Focus the input when autoFocus is true
  useEffect(() => {
    if (autoFocus) {
      // setTimeout ensures DOM is ready when panel opens fresh
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [autoFocus])

  // Format value for editing
  const editValue = isNull || isDefault
    ? ''
    : isJson
      ? typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      : String(value)

  const isMultiline = isJson || editValue.includes('\n') || editValue.length > 100

  // Show "Use DEFAULT" checkbox only for new rows and columns with defaults
  const showDefaultCheckbox = isNewRow && hasDefault

  if (isBool) {
    return (
      <div className="space-y-1">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={isDefault ? 'default' : isNull ? 'null' : String(value)}
          onChange={(e) => {
            if (e.target.value === 'null') {
              onSetNull()
            } else if (e.target.value === 'default') {
              onSetDefault()
            } else {
              onChange(e.target.value)
            }
          }}
          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {showDefaultCheckbox && <option value="default">DEFAULT</option>}
          {isNullable && <option value="null">null</option>}
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {isDefault ? (
        <div className={`${valueBaseStyles} bg-gray-100 italic text-gray-500`}>DEFAULT</div>
      ) : isMultiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isNull ? 'null' : ''}
          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] max-h-64 resize-y font-mono"
          rows={4}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isNull ? 'null' : ''}
          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
      <div className="flex items-center gap-4">
        {showDefaultCheckbox && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => {
                if (e.target.checked) {
                  onSetDefault()
                } else {
                  onChange('')
                }
              }}
              className="rounded border-gray-300"
            />
            Use DEFAULT
          </label>
        )}
        {isNullable && !isDefault && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={isNull}
              onChange={(e) => {
                if (e.target.checked) {
                  onSetNull()
                } else {
                  onChange('')
                }
              }}
              className="rounded border-gray-300"
            />
            Set to NULL
          </label>
        )}
      </div>
    </div>
  )
}

export function RowDetailPanel({
  row,
  columns,
  open,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  scrollToColumn,
  currentIndex,
  totalCount,
  onExpandJson,
  onEdit,
  isEditing,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  stagedType,
  stagedOverrides,
  onDiscardStaged,
  autoEditColumn,
  onAutoEditHandled,
  isNewRow,
}: RowDetailPanelProps) {
  const [search, setSearch] = useState('')
  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(null)
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({})
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const contentRef = useRef<HTMLDivElement>(null)

  // Initialize edited values when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedValues({ ...row })
    } else {
      setEditedValues({})
    }
  }, [isEditing, row])

  const handleFieldChange = useCallback((colName: string, value: string, colType: string) => {
    setEditedValues(prev => {
      // Try to preserve type for numbers and booleans
      if (colType === 'integer' || colType === 'int4' || colType === 'int8' || colType === 'bigint' || colType === 'smallint') {
        const num = parseInt(value, 10)
        return { ...prev, [colName]: isNaN(num) ? value : num }
      }
      if (colType === 'numeric' || colType === 'decimal' || colType === 'real' || colType === 'float4' || colType === 'float8' || colType === 'double precision') {
        const num = parseFloat(value)
        return { ...prev, [colName]: isNaN(num) ? value : num }
      }
      if (colType === 'boolean' || colType === 'bool') {
        return { ...prev, [colName]: value.toLowerCase() === 'true' }
      }
      return { ...prev, [colName]: value }
    })
  }, [])

  const handleSave = useCallback(() => {
    if (onSaveEdit) {
      onSaveEdit(editedValues)
    }
  }, [editedValues, onSaveEdit])

  // Check if all required PK columns are filled for new rows
  const missingRequiredPK = useMemo(() => {
    if (!isNewRow) return false
    return columns.some(col => {
      if (!col.isPrimaryKey) return false
      const value = editedValues[col.name]
      // For columns with defaults, undefined means "USE DEFAULT" which is valid
      if (col.hasDefault && value === undefined) return false
      // PK is missing if empty string, null, or undefined (when no default)
      return value === '' || value === null || value === undefined
    })
  }, [columns, editedValues, isNewRow])

  const hasChanges = useMemo(() => {
    // For new rows, check if PK columns are filled
    if (isNewRow) return !missingRequiredPK
    return columns.some(col => editedValues[col.name] !== row[col.name])
  }, [columns, editedValues, row, isNewRow, missingRequiredPK])

  // Filter columns based on search (matches column name or value)
  const filteredColumns = useMemo(() => {
    if (!search) return columns
    const lowerSearch = search.toLowerCase()
    return columns.filter((col) => {
      const colMatch = col.name.toLowerCase().includes(lowerSearch)
      const value = row[col.name]
      const valueMatch = value !== null && value !== undefined &&
        String(value).toLowerCase().includes(lowerSearch)
      return colMatch || valueMatch
    })
  }, [columns, row, search])

  // Clear search when row changes
  useEffect(() => {
    setSearch('')
  }, [row])

  // Scroll to target column when panel opens and highlight it
  useEffect(() => {
    if (open && scrollToColumn) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const element = columnRefs.current.get(scrollToColumn)
        if (element && contentRef.current) {
          element.scrollIntoView({ behavior: 'instant', block: 'center' })
        }
      })
      setHighlightedColumn(scrollToColumn)
    } else {
      setHighlightedColumn(null)
    }
  }, [open, scrollToColumn])

  // Clear autoEditColumn after focus has been applied
  useEffect(() => {
    if (open && isEditing && autoEditColumn) {
      const timer = setTimeout(() => onAutoEditHandled?.(), 50)
      return () => clearTimeout(timer)
    }
  }, [open, isEditing, autoEditColumn, onAutoEditHandled])

  useKeyboardShortcut('row-detail-close', 'Escape', () => {
    if (isEditing && onCancelEdit) {
      onCancelEdit()
    } else {
      onClose()
    }
  }, { when: () => open })

  if (!open) return null

  return createPortal(
    <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="shrink-0 px-2 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {isEditing ? (
            <>
              <span className="text-xs font-medium text-gray-700">{isNewRow ? 'New row' : 'Editing row'}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelEdit}
                  tabIndex={-1}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  tabIndex={-1}
                >
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={onPrevious}
                  disabled={!hasPrevious}
                  title="Previous row (k or ↑)"
                  tabIndex={-1}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={onNext}
                  disabled={!hasNext}
                  title="Next row (j or ↓)"
                  tabIndex={-1}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <span className="text-xs text-gray-500 ml-1">
                  {currentIndex}/{totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <Tooltip>
                    <TooltipTrigger
                      className="p-1 rounded hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      onClick={stagedType ? undefined : onEdit}
                      disabled={!!stagedType}
                      tabIndex={-1}
                    >
                      <Pencil className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {stagedType ? `Cannot edit row staged for ${stagedType}` : 'Edit row'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {onDelete && (
                  <Tooltip>
                    <TooltipTrigger
                      className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      onClick={stagedType ? undefined : onDelete}
                      disabled={!!stagedType}
                      tabIndex={-1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {stagedType ? `Row already staged for ${stagedType}` : 'Stage row for deletion'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {stagedType && onDiscardStaged && (
                  <Tooltip>
                    <TooltipTrigger
                      className="p-1 rounded text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={onDiscardStaged}
                      tabIndex={-1}
                    >
                      <Undo2 className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Discard staged change
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={onClose}
                  tabIndex={-1}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            size="sm"
          />
        )}
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto p-3 space-y-3">
        {filteredColumns.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">
            No matching columns
          </div>
        ) : (
          filteredColumns.map((col) => {
            const { name: colName, type: colType } = col
            // Use editedValues if populated, otherwise fall back to row (handles first render before effect runs)
            const value = isEditing ? (colName in editedValues ? editedValues[colName] : row[colName]) : row[colName]
            const isNull = value === null
            const isUndefined = value === undefined
            const formattedValue = formatValue(value, colType)
            const isModified = isEditing && editedValues[colName] !== row[colName]
            const isStaged = !isEditing && stagedOverrides && colName in stagedOverrides
            // For staged inserts, undefined values mean DEFAULT (read-only view)
            const isStagedInsert = stagedType === 'insert'
            const showDefault = isUndefined && isStagedInsert && !isEditing

            const isHighlighted = highlightedColumn === colName

            return (
              <div
                key={colName}
                ref={(el) => {
                  if (el) {
                    columnRefs.current.set(colName, el)
                  } else {
                    columnRefs.current.delete(colName)
                  }
                }}
              >
                {/* Column header: name + type */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium truncate ${isModified || isStaged ? 'text-amber-600' : isHighlighted ? 'text-blue-600' : 'text-gray-700'}`}>
                    {isEditing ? colName : <HighlightedText text={colName} search={search} />}
                    {col.isPrimaryKey && isNewRow && !col.hasDefault && <span className="ml-1 text-red-500">*</span>}
                    {col.isPrimaryKey && <span className="ml-1 text-gray-400">(PK{isNewRow && !col.hasDefault ? ', required' : ''})</span>}
                    {col.hasDefault && <span className="ml-1 text-gray-400">(has default)</span>}
                    {(isModified || isStaged) && <span className="ml-1 text-amber-500">*</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">{colType}</span>
                    {!isEditing && isJsonType(colType) && !isNull && !isUndefined && onExpandJson && (
                      <button
                        onClick={() => onExpandJson(value, colName)}
                        className="p-1 rounded hover:bg-accent text-gray-400 hover:text-gray-600 transition-colors"
                        title="Expand JSON"
                      >
                        <Expand className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isEditing && !showDefault && <CopyButton value={formattedValue} />}
                  </div>
                </div>

                {/* Value - editable or read-only */}
                {isEditing ? (
                  <EditableField
                    value={value}
                    colType={colType}
                    isNullable={col.isNullable}
                    hasDefault={col.hasDefault}
                    isNewRow={isNewRow || false}
                    onChange={(newValue) => handleFieldChange(colName, newValue, colType)}
                    onSetNull={() => setEditedValues(prev => ({ ...prev, [colName]: null }))}
                    onSetDefault={() => setEditedValues(prev => ({ ...prev, [colName]: undefined }))}
                    autoFocus={autoEditColumn === colName}
                  />
                ) : showDefault ? (
                  <div className={`${valueBaseStyles} bg-green-50 border-green-200 italic text-gray-500`}>DEFAULT</div>
                ) : isNull ? (
                  <div className={`${valueBaseStyles} ${isStaged ? 'bg-amber-50 border-amber-200' : ''} italic text-gray-400`}>null</div>
                ) : (
                  <ValueRenderer value={formattedValue} search={search} isJson={isJsonType(colType)} isStaged={isStaged} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>,
    document.body
  )
}

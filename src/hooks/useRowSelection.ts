import { useState, useCallback, useEffect } from 'react'

interface UseRowSelectionOptions {
  totalRows: number
  onDelete?: (selectedIndices: number[]) => void
}

export function useRowSelection({ totalRows, onDelete }: UseRowSelectionOptions) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null)

  // Clear selection when total rows changes (new query result)
  useEffect(() => {
    setSelectedIndices(new Set())
    setAnchorIndex(null)
  }, [totalRows])

  const handleRowClick = useCallback((
    index: number,
    event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
  ) => {
    const isRangeSelect = event.shiftKey
    const isToggleSelect = event.metaKey || event.ctrlKey

    if (isRangeSelect && anchorIndex !== null) {
      // Range select from anchor to clicked
      const start = Math.min(anchorIndex, index)
      const end = Math.max(anchorIndex, index)
      const newSelection = new Set<number>()
      for (let i = start; i <= end; i++) {
        newSelection.add(i)
      }
      setSelectedIndices(newSelection)
    } else if (isToggleSelect) {
      // Toggle individual selection
      setSelectedIndices(prev => {
        const newSet = new Set(prev)
        if (newSet.has(index)) {
          newSet.delete(index)
        } else {
          newSet.add(index)
        }
        return newSet
      })
      setAnchorIndex(index)
    } else {
      // Single select
      setSelectedIndices(new Set([index]))
      setAnchorIndex(index)
    }
  }, [anchorIndex])

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set())
    setAnchorIndex(null)
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      clearSelection()
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIndices.size > 0) {
      event.preventDefault()
      onDelete?.(Array.from(selectedIndices).sort((a, b) => a - b))
    }
  }, [selectedIndices, onDelete, clearSelection])

  // Attach keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    selectedIndices,
    handleRowClick,
    clearSelection,
    isSelected: (index: number) => selectedIndices.has(index),
    selectionCount: selectedIndices.size,
  }
}

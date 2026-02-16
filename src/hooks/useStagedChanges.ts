import { useState, useCallback, useMemo } from 'react'
import type { StagedChange } from '@/lib/staged-changes'

export function useStagedChanges(tabId: string | null) {
  // Store staged changes per tab
  const [stagedChangesByTab, setStagedChangesByTab] = useState<Map<string, StagedChange[]>>(new Map())

  const stagedChanges = useMemo(() => {
    if (!tabId) return []
    return stagedChangesByTab.get(tabId) || []
  }, [stagedChangesByTab, tabId])

  const addStagedChange = useCallback((change: StagedChange) => {
    if (!tabId) return
    setStagedChangesByTab(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(tabId) || []
      newMap.set(tabId, [...existing, change])
      return newMap
    })
  }, [tabId])

  const removeStagedChange = useCallback((id: string) => {
    if (!tabId) return
    setStagedChangesByTab(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(tabId) || []
      newMap.set(tabId, existing.filter(c => c.id !== id))
      return newMap
    })
  }, [tabId])

  const clearAllStagedChanges = useCallback(() => {
    if (!tabId) return
    setStagedChangesByTab(prev => {
      const newMap = new Map(prev)
      newMap.delete(tabId)
      return newMap
    })
  }, [tabId])

  return {
    stagedChanges,
    addStagedChange,
    removeStagedChange,
    clearAllStagedChanges,
    hasStagedChanges: stagedChanges.length > 0,
  }
}

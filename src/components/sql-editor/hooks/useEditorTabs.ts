import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ObjectType } from '../ObjectTree' // Used for SchemaTab.objectType

export interface QueryTab {
  type: 'query'
  id: string
  name: string
  content: string
}

export interface SchemaTab {
  type: 'schema'
  id: string
  name: string
  schema: string
  table: string
  objectType?: ObjectType // 'table', 'view', 'materialized_view', 'function', 'procedure'
  arguments?: string // For function/procedure overloading
}

export type EditorTab = QueryTab | SchemaTab

export interface ColumnMetadata {
  name: string
  type: string
  tableName: string
  schemaName: string
  isPrimaryKey: boolean
  isNullable: boolean
  hasDefault: boolean
}

export interface QueryResult {
  columns: ColumnMetadata[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
  error?: string
}

export interface ResultTab {
  id: string
  title: string // e.g., "10:30:45" or "10:30:45 (1)" for multi-statement
  result: QueryResult
  sql?: string // Original SQL query for refresh
}

export interface TabState {
  tab: EditorTab
  resultTabs: ResultTab[]
  activeResultTabId: string | null
  isExecuting: boolean
  editorHeight: number
  foldedRanges?: string[] // Array of "from:to" strings for folded regions
}

export type PanelTab = 'context' | 'chat'

export interface RightPanelState {
  open: boolean
  activeTab: PanelTab
  width: number
}

// Defaults
const DEFAULT_EDITOR_HEIGHT = 0 // 0 means equal split (50/50)
const DEFAULT_RIGHT_PANEL_WIDTH = 320
const DEFAULT_LEFT_SIDEBAR_WIDTH = 240

interface ConnectionTabsState {
  tabs: TabState[]
  activeTabId: string
  tabCounter: number
  rightPanel: RightPanelState
  leftSidebarWidth: number
}

// ============ Content Storage (tabs, active states) ============
const CONTENT_STORAGE_KEY = 'pgconsole-editor'

interface PersistedTabContent {
  tab: EditorTab
}

interface PersistedConnectionContent {
  tabs: PersistedTabContent[]
  activeTabId: string
  tabCounter: number
  rightPanelOpen: boolean
}

interface PersistedContent {
  byConnection: Record<string, PersistedConnectionContent>
}

// ============ Layout Storage (dimensions) ============
const LAYOUT_STORAGE_KEY = 'pgconsole-layout'

interface PersistedConnectionLayout {
  editorHeight: number
  rightPanelWidth: number
  leftSidebarWidth: number
}

interface PersistedLayout {
  rightPanelActiveTab?: PanelTab // Global setting
  byConnection: Record<string, PersistedConnectionLayout>
}

function loadContentFromStorage(): PersistedContent {
  try {
    const stored = localStorage.getItem(CONTENT_STORAGE_KEY)
    if (!stored) return { byConnection: {} }
    return JSON.parse(stored)
  } catch {
    return { byConnection: {} }
  }
}

function loadLayoutFromStorage(): PersistedLayout {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!stored) return { byConnection: {} }
    return JSON.parse(stored)
  } catch {
    return { byConnection: {} }
  }
}

function loadFromStorage(): Record<string, ConnectionTabsState> {
  const content = loadContentFromStorage()
  const layout = loadLayoutFromStorage()
  const restored: Record<string, ConnectionTabsState> = {}
  const globalActiveTab = layout.rightPanelActiveTab ?? 'context'

  for (const [connId, connContent] of Object.entries(content.byConnection ?? {})) {
    const connLayout = layout.byConnection?.[connId]
    const editorHeight = connLayout?.editorHeight ?? DEFAULT_EDITOR_HEIGHT
    restored[connId] = {
      activeTabId: connContent.activeTabId,
      tabCounter: connContent.tabCounter || 0,
      rightPanel: {
        open: connContent.rightPanelOpen ?? true,
        activeTab: globalActiveTab,
        width: connLayout?.rightPanelWidth ?? DEFAULT_RIGHT_PANEL_WIDTH,
      },
      leftSidebarWidth: connLayout?.leftSidebarWidth ?? DEFAULT_LEFT_SIDEBAR_WIDTH,
      tabs: connContent.tabs.map((t) => ({
        tab: t.tab,
        resultTabs: [],
        activeResultTabId: null,
        isExecuting: false,
        editorHeight,
      })),
    }
  }
  return restored
}

function saveContentToStorage(tabsByConnection: Record<string, ConnectionTabsState>) {
  try {
    const toSave: PersistedContent = {
      byConnection: {},
    }

    for (const [connId, connState] of Object.entries(tabsByConnection)) {
      toSave.byConnection[connId] = {
        activeTabId: connState.activeTabId,
        tabCounter: connState.tabCounter,
        rightPanelOpen: connState.rightPanel.open,
        tabs: connState.tabs.map((t) => ({ tab: t.tab })),
      }
    }

    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // Ignore storage errors
  }
}

function saveLayoutToStorage(tabsByConnection: Record<string, ConnectionTabsState>) {
  try {
    const toSave: PersistedLayout = {
      byConnection: {},
    }

    // Save global right panel active tab from any connection (they're all the same)
    const firstConnection = Object.values(tabsByConnection)[0]
    if (firstConnection) {
      toSave.rightPanelActiveTab = firstConnection.rightPanel.activeTab
    }

    for (const [connId, connState] of Object.entries(tabsByConnection)) {
      // Use the active tab's editor height, or the first tab's, or default
      const activeTab = connState.tabs.find((t) => t.tab.id === connState.activeTabId)
      const editorHeight = activeTab?.editorHeight ?? connState.tabs[0]?.editorHeight ?? DEFAULT_EDITOR_HEIGHT
      toSave.byConnection[connId] = {
        editorHeight,
        rightPanelWidth: connState.rightPanel.width,
        leftSidebarWidth: connState.leftSidebarWidth ?? DEFAULT_LEFT_SIDEBAR_WIDTH,
      }
    }

    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // Ignore storage errors
  }
}

export function useEditorTabs(connectionId: string) {
  // Store tabs per connection, initialized from localStorage
  const [tabsByConnection, setTabsByConnection] = useState<Record<string, ConnectionTabsState>>(loadFromStorage)

  // Save to localStorage when state changes
  useEffect(() => {
    saveContentToStorage(tabsByConnection)
    saveLayoutToStorage(tabsByConnection)
  }, [tabsByConnection])

  // Get global active tab from any existing connection, or default to 'context'
  const getGlobalActiveTab = (): PanelTab => {
    const firstConnection = Object.values(tabsByConnection)[0]
    return firstConnection?.rightPanel.activeTab ?? 'context'
  }

  // Get current connection's state
  const getDefaultRightPanel = (): RightPanelState => ({
    open: true,
    activeTab: getGlobalActiveTab(),
    width: DEFAULT_RIGHT_PANEL_WIDTH,
  })

  const currentState = tabsByConnection[connectionId] ?? {
    tabs: [],
    activeTabId: '',
    tabCounter: 0,
    rightPanel: getDefaultRightPanel(),
    leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
  }
  const tabs = currentState.tabs
  const activeTabId = currentState.activeTabId
  const rightPanel = currentState.rightPanel ?? getDefaultRightPanel()
  const leftSidebarWidth = currentState.leftSidebarWidth ?? DEFAULT_LEFT_SIDEBAR_WIDTH

  const activeTab = useMemo(
    () => tabs.find((t) => t.tab.id === activeTabId) ?? null,
    [tabs, activeTabId]
  )

  const getEmptyState = (): ConnectionTabsState => ({
    tabs: [],
    activeTabId: '',
    tabCounter: 0,
    rightPanel: getDefaultRightPanel(),
    leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
  })

  const setActiveTabId = useCallback((id: string) => {
    setTabsByConnection((prev) => ({
      ...prev,
      [connectionId]: {
        ...(prev[connectionId] ?? getEmptyState()),
        activeTabId: id,
      },
    }))
  }, [connectionId])

  const setTabs = useCallback((updater: (prev: TabState[]) => TabState[]) => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      return {
        ...prev,
        [connectionId]: {
          ...current,
          tabs: updater(current.tabs),
        },
      }
    })
  }, [connectionId])

  const createTab = useCallback((content = '', options?: { isExecuting?: boolean }) => {
    // Generate unique ID immediately, before state update
    // This ensures tabId is available even if React defers the state callback
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      // Inherit editor height from active tab, or use default (50/50) if no tabs
      const activeTab = current.tabs.find((t) => t.tab.id === current.activeTabId)
      const inheritedHeight = activeTab?.editorHeight ?? DEFAULT_EDITOR_HEIGHT
      const newTab: TabState = {
        tab: {
          type: 'query',
          id: newTabId,
          name: `SQL ${current.tabCounter + 1}`,
          content,
        },
        resultTabs: [],
        activeResultTabId: null,
        isExecuting: options?.isExecuting ?? false,
        editorHeight: inheritedHeight,
      }
      return {
        ...prev,
        [connectionId]: {
          ...current,
          tabs: [newTab, ...current.tabs],
          activeTabId: newTabId,
          tabCounter: current.tabCounter + 1,
        },
      }
    })
    return newTabId
  }, [connectionId])

  const createSchemaTab = useCallback((schema: string, table: string, objectType?: ObjectType, args?: string) => {
    // Include args in tabId for function/procedure overloading
    const tabId = args !== undefined ? `schema.${schema}.${table}(${args})` : `schema.${schema}.${table}`

    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()

      // Check if tab already exists (inside updater to avoid race conditions)
      const existingTab = current.tabs.find((t) => t.tab.id === tabId)
      if (existingTab) {
        // Just switch to existing tab
        return {
          ...prev,
          [connectionId]: {
            ...current,
            activeTabId: tabId,
          },
        }
      }

      // Create new tab
      const newTab: TabState = {
        tab: {
          type: 'schema',
          id: tabId,
          name: table,
          schema,
          table,
          objectType,
          arguments: args,
        },
        resultTabs: [],
        activeResultTabId: null,
        isExecuting: false,
        editorHeight: 0,
      }

      return {
        ...prev,
        [connectionId]: {
          ...current,
          tabs: [newTab, ...current.tabs],
          activeTabId: tabId,
        },
      }
    })
    return tabId
  }, [connectionId])

  const closeTab = useCallback((id: string) => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      const remaining = current.tabs.filter((t) => t.tab.id !== id)
      const newActiveId = current.activeTabId === id
        ? remaining[0]?.tab.id ?? ''
        : current.activeTabId
      return {
        ...prev,
        [connectionId]: {
          ...current,
          tabs: remaining,
          activeTabId: newActiveId,
        },
      }
    })
  }, [connectionId])

  const closeOtherTabs = useCallback((id: string) => {
    setTabs((prev) => prev.filter((t) => t.tab.id === id))
    setActiveTabId(id)
  }, [setTabs, setActiveTabId])

  const closeTabsToRight = useCallback((id: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.tab.id === id)
      if (index === -1) return prev
      return prev.slice(0, index + 1)
    })
  }, [setTabs])

  const closeAllTabs = useCallback(() => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      return {
        ...prev,
        [connectionId]: { ...current, tabs: [], activeTabId: '' },
      }
    })
  }, [connectionId])

  const updateTabContent = useCallback((id: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.tab.id === id ? { ...t, tab: { ...t.tab, content } } : t
      )
    )
  }, [setTabs])

  const formatTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const setTabResults = useCallback((id: string, results: QueryResult[], options?: { isExecuting?: boolean; sql?: string }) => {
    const timeStr = formatTimestamp()

    const newResultTabs: ResultTab[] = results.map((result, index) => {
      const isCancelled = result.error?.toLowerCase().includes('cancel')
      let title = results.length > 1 ? `${timeStr} (${index + 1})` : timeStr
      if (isCancelled) {
        title += ' (cancelled)'
      }
      return {
        id: crypto.randomUUID(),
        title,
        result,
        sql: options?.sql,
      }
    })

    setTabs((prev) =>
      prev.map((t) =>
        t.tab.id === id
          ? {
              ...t,
              resultTabs: [...newResultTabs, ...t.resultTabs],
              activeResultTabId: newResultTabs[0]?.id ?? t.activeResultTabId,
              ...(options?.isExecuting !== undefined && { isExecuting: options.isExecuting }),
            }
          : t
      )
    )
  }, [setTabs])

  const setActiveResultTab = useCallback((tabId: string, resultTabId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.tab.id === tabId ? { ...t, activeResultTabId: resultTabId } : t
      )
    )
  }, [setTabs])

  const setTabExecuting = useCallback((id: string, isExecuting: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.tab.id === id ? { ...t, isExecuting } : t))
    )
  }, [setTabs])

  const setEditorHeight = useCallback((id: string, height: number) => {
    setTabs((prev) =>
      prev.map((t) => (t.tab.id === id ? { ...t, editorHeight: height } : t))
    )
  }, [setTabs])

  const setFoldedRanges = useCallback((id: string, ranges: string[]) => {
    setTabs((prev) =>
      prev.map((t) => (t.tab.id === id ? { ...t, foldedRanges: ranges } : t))
    )
  }, [setTabs])

  const getFoldedRanges = useCallback((id: string): string[] => {
    const tab = tabs.find((t) => t.tab.id === id)
    return tab?.foldedRanges ?? []
  }, [tabs])

  const setRightPanelOpen = useCallback((open: boolean) => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      return {
        ...prev,
        [connectionId]: {
          ...current,
          rightPanel: { ...current.rightPanel, open },
        },
      }
    })
  }, [connectionId])

  const setRightPanelActiveTab = useCallback((activeTab: PanelTab) => {
    setTabsByConnection((prev) => {
      // Update all connections with the same global active tab
      const updated: Record<string, ConnectionTabsState> = {}
      for (const [connId, connState] of Object.entries(prev)) {
        updated[connId] = {
          ...connState,
          rightPanel: { ...connState.rightPanel, activeTab },
        }
      }
      // Also update current connection if it doesn't exist yet
      if (!updated[connectionId]) {
        updated[connectionId] = {
          ...getEmptyState(),
          rightPanel: { ...getEmptyState().rightPanel, activeTab },
        }
      }
      return updated
    })
  }, [connectionId])

  const setRightPanelWidth = useCallback((width: number) => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      return {
        ...prev,
        [connectionId]: {
          ...current,
          rightPanel: { ...current.rightPanel, width },
        },
      }
    })
  }, [connectionId])

  const setLeftSidebarWidth = useCallback((width: number) => {
    setTabsByConnection((prev) => {
      const current = prev[connectionId] ?? getEmptyState()
      return {
        ...prev,
        [connectionId]: {
          ...current,
          leftSidebarWidth: width,
        },
      }
    })
  }, [connectionId])

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    createTab,
    createSchemaTab,
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
    rightPanel,
    setRightPanelOpen,
    setRightPanelActiveTab,
    setRightPanelWidth,
    leftSidebarWidth,
    setLeftSidebarWidth,
  }
}

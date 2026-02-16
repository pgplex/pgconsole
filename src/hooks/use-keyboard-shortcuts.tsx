import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'

export interface KeyboardShortcut {
  id: string
  key: string | string[] // Support multiple keys (e.g., ['k', 'ArrowUp'])
  modifiers?: ('ctrl' | 'meta' | 'alt' | 'shift')[]
  handler: () => void
  when?: () => boolean
  allowInInputs?: boolean
  priority?: number
}

interface ShortcutEntry extends KeyboardShortcut {
  key: string[]
  priority: number
}

interface KeyboardShortcutsContextValue {
  register: (shortcut: KeyboardShortcut) => void
  unregister: (id: string) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

function isEditableElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  )
}

function matchesModifiers(event: KeyboardEvent, modifiers?: ('ctrl' | 'meta' | 'alt' | 'shift')[]): boolean {
  const required = modifiers ?? []
  const cmdOrCtrlRequired = required.includes('ctrl') || required.includes('meta')
  const cmdOrCtrlPressed = event.ctrlKey || event.metaKey

  if (cmdOrCtrlRequired !== cmdOrCtrlPressed) return false
  if (required.includes('alt') !== event.altKey) return false
  if (required.includes('shift') !== event.shiftKey) return false

  return true
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const shortcutsRef = useRef<Map<string, ShortcutEntry>>(new Map())

  const register = useCallback((shortcut: KeyboardShortcut) => {
    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key]
    shortcutsRef.current.set(shortcut.id, {
      ...shortcut,
      key: keys,
      priority: shortcut.priority ?? 0,
    })
  }, [])

  const unregister = useCallback((id: string) => {
    shortcutsRef.current.delete(id)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcuts = Array.from(shortcutsRef.current.values())
        .sort((a, b) => b.priority - a.priority)

      for (const shortcut of shortcuts) {
        // Check key match
        const keyMatches = shortcut.key.some(k => event.key.toLowerCase() === k.toLowerCase())
        if (!keyMatches) continue

        // Check modifiers
        if (!matchesModifiers(event, shortcut.modifiers)) continue

        // Check editable element
        if (!shortcut.allowInInputs && isEditableElement(event.target)) continue

        // Check when condition
        if (shortcut.when && !shortcut.when()) continue

        // Execute
        event.preventDefault()
        shortcut.handler()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <KeyboardShortcutsContext.Provider value={{ register, unregister }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

/**
 * Register a keyboard shortcut. The shortcut object can be recreated on each render -
 * the hook uses refs internally to always call the latest handler/when functions.
 */
export function useKeyboardShortcut(
  id: string,
  key: string | string[],
  handler: () => void,
  options?: {
    modifiers?: ('ctrl' | 'meta' | 'alt' | 'shift')[]
    when?: () => boolean
    allowInInputs?: boolean
    priority?: number
  }
): void {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcut must be used within a KeyboardShortcutsProvider')
  }

  const { register, unregister } = context

  // Store latest values in refs so we don't need to re-register on every change
  const handlerRef = useRef(handler)
  const whenRef = useRef(options?.when)
  handlerRef.current = handler
  whenRef.current = options?.when

  useEffect(() => {
    register({
      id,
      key,
      handler: () => handlerRef.current(),
      when: whenRef.current ? () => whenRef.current!() : undefined,
      modifiers: options?.modifiers,
      allowInInputs: options?.allowInInputs,
      priority: options?.priority,
    })
    return () => unregister(id)
    // Only re-register if id, key, or static options change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(key), options?.modifiers?.join(), options?.allowInInputs, options?.priority, register, unregister])
}

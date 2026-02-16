import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface TabBarItem {
  id: string
  label: string
  className?: string
}

interface TabBarProps {
  tabs: TabBarItem[]
  activeTabId: string | null
  onTabSelect: (id: string) => void
  className?: string
}

export function TabBar({ tabs, activeTabId, onTabSelect, className }: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault()
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "flex items-center min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden",
        className
      )}
      onWheel={handleWheel}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'relative flex items-center h-7 px-2 cursor-pointer text-xs shrink-0',
            activeTabId === tab.id
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
            tab.className
          )}
          onClick={() => onTabSelect(tab.id)}
        >
          {tab.label}
          {activeTabId === tab.id && (
            <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-blue-500 rounded-full" />
          )}
        </div>
      ))}
    </div>
  )
}

import { Home, Settings } from 'lucide-react'
import type { ComponentType } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { useMemo } from 'react'

export type GutterItem = 'home' | 'settings'

// Re-export as a const for runtime access
export const GUTTER_ITEMS = ['home', 'settings'] as const

interface GutterProps {
  activeItem: GutterItem
  onItemClick: (item: GutterItem) => void
}

export default function Gutter({ activeItem, onItemClick }: GutterProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine context from URL
  const context = useMemo(() => {
    // Match /org/:orgSlug (with optional /settings)
    const orgMatch = location.pathname.match(/^\/org\/([^/]+)/)
    if (!orgMatch) return null

    const orgSlug = orgMatch[1]

    return { orgSlug }
  }, [location.pathname])

  const handleClick = (id: GutterItem) => {
    onItemClick(id)

    if (!context) return

    if (id === 'home') {
      navigate(`/org/${context.orgSlug}`)
    } else if (id === 'settings') {
      navigate(`/org/${context.orgSlug}/settings`)
    }
  }

  const gutterIcons: { id: GutterItem; Icon: ComponentType<{ size?: number }>; label: string }[] = [
    { id: 'home', Icon: Home, label: 'Organization Home' },
    { id: 'settings', Icon: Settings, label: 'Organization Settings' },
  ]

  const renderButton = ({ id, Icon, label }: { id: GutterItem; Icon: ComponentType<any>; label: string }) => {
    const isActive = activeItem === id
    return (
      <Button
        key={id}
        onClick={() => handleClick(id)}
        variant={isActive ? 'default' : 'ghost'}
        size="icon-sm"
        aria-label={label}
        title={label}
      >
        <Icon size={18} strokeWidth={2} />
      </Button>
    )
  }

  return (
    <div className="w-12 bg-gray-100 border-r border-gray-300 flex flex-col items-center py-2 gap-1">
      {/* Context-specific icons */}
      <div className="flex flex-col gap-1">
        {gutterIcons.map(renderButton)}
      </div>
    </div>
  )
}

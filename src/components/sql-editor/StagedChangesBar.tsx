import { X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StagedChangesBarProps {
  count: number
  onClear: () => void
  onPreview: () => void
}

export function StagedChangesBar({ count, onClear, onPreview }: StagedChangesBarProps) {
  if (count === 0) return null

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 text-white rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <Button
        variant="ghost"
        size="xs"
        onClick={onClear}
        className="text-gray-300 hover:text-white hover:bg-gray-700"
        title="Clear all staged changes"
      >
        <X className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={onPreview}
        className="text-gray-300 hover:text-white hover:bg-gray-700 gap-1.5"
      >
        <Eye className="w-4 h-4" />
        <span>Preview Changes</span>
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 rounded-full">
          {count}
        </span>
      </Button>
    </div>
  )
}

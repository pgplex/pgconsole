import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  isDragging?: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export function ResizeHandle({ direction, isDragging, onMouseDown }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal'

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'flex items-center justify-center shrink-0',
        'bg-gray-100 hover:bg-gray-200 active:bg-gray-300',
        isDragging && 'bg-gray-300',
        isHorizontal
          ? 'h-1.5 border-y border-gray-200 cursor-row-resize'
          : 'w-1.5 border-x border-gray-200 cursor-col-resize'
      )}
    >
      <div
        className={cn(
          'bg-gray-400 rounded-full',
          isHorizontal ? 'w-8 h-0.5' : 'h-8 w-0.5'
        )}
      />
    </div>
  )
}

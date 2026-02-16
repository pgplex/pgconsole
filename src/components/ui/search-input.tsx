import { Search, X } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import type { InputProps } from './input'

interface SearchInputProps extends Omit<InputProps, 'type'> {
  onClear?: () => void
}

export function SearchInput({
  value,
  onClear,
  className,
  ...props
}: SearchInputProps) {
  const hasValue = value !== undefined && value !== null && String(value).length > 0

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        className={`[&_[data-slot=input]]:pl-8 ${hasValue ? '[&_[data-slot=input]]:pr-8' : ''} ${className || ''}`}
        {...props}
      />
      {hasValue && onClear && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2"
          onClick={onClear}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  )
}

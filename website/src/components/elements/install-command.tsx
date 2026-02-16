import { ElCopyable } from '@tailwindplus/elements/react'
import { clsx } from 'clsx/lite'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { CheckmarkIcon } from '../icons/checkmark-icon'
import { Squares2StackedIcon } from '../icons/squares-2-stacked-icon'

export function InstallCommand({
  snippet,
  variant = 'normal',
  className,
  ...props
}: {
  snippet: ReactNode
  variant?: 'normal' | 'overlay'
} & ComponentProps<'div'>) {
  const id = useId()
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-6 rounded-full p-1 font-mono text-sm/7 inset-ring-1 dark:bg-white/10 dark:inset-ring-white/10',
        variant === 'normal' && 'bg-white text-mist-600 inset-ring-black/10 dark:text-white',
        variant === 'overlay' && 'bg-white/15 text-white inset-ring-white/10',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 pl-3">
        <div className="text-current/60 select-none">$</div>
        <ElCopyable id={id}>{snippet}</ElCopyable>
      </div>
      <button
        command="--copy"
        commandfor={id}
        type="button"
        className="group relative flex size-9 items-center justify-center rounded-full after:absolute after:-inset-1 hover:bg-mist-950/10 dark:hover:bg-white/10 after:pointer-fine:hidden"
      >
        <Squares2StackedIcon className="group-data-copied:hidden" />
        <CheckmarkIcon className="not-group-data-copied:hidden" />
      </button>
    </div>
  )
}

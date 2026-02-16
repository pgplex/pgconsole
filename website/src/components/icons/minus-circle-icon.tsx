import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function MinusCircleIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 13 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5h4" />
    </svg>
  )
}

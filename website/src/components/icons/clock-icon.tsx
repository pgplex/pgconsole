import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ClockIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M6.5 2.5v4h3" />
    </svg>
  )
}

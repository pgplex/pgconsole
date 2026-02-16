import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function AtSymbolIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <circle cx="6.5" cy="6.5" r="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.743 10.743A6 6 0 1 1 12.5 6.5a1.5 1.5 0 0 1-3 0v-2"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function AlertTriangleIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path
        d="M5.63396 1.75C6.01886 1.08333 6.98111 1.08333 7.36601 1.75L12.1291 10C12.514 10.6667 12.0329 11.5 11.2631 11.5H1.73684C0.967042 11.5 0.485918 10.6667 0.870818 10L5.63396 1.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 5.5V7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 9.5L6.5 9.51" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

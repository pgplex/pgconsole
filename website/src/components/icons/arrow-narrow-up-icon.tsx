import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArrowNarrowUpIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={7}
      height={13}
      viewBox="0 0 7 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path d="M3.5 0.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.50488 3.50488L3.50488 0.504883L0.504883 3.50488"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

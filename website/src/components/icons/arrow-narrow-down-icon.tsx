import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArrowNarrowDownIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M3.50977 12.5L3.50977 0.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M0.504883 9.49512L3.50488 12.4951L6.50488 9.49512"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

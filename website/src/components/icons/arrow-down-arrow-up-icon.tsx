import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArrowDownArrowUpIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M3.50977 12.5L3.50977 0.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 0.5L9.5 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M0.504883 9.49512L3.50488 12.4951L6.50488 9.49512"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5049 3.50488L9.50488 0.504882L6.50488 3.50488"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

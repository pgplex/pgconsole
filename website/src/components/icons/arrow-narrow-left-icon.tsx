import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArrowNarrowLeftIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={7}
      viewBox="0 0 13 7"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path d="M0.504883 3.50488L12.5049 3.50488" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.50977 0.5L0.509766 3.5L3.50977 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

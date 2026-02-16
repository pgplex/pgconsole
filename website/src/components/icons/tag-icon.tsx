import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function TagIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M.5 5.672V2.5a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l4.707 4.707a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L1.086 7.086A2 2 0 0 1 .5 5.672Zm3-2.172v.01"
      />
    </svg>
  )
}

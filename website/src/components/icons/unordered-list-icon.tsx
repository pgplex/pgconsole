import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function UnorderedListIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={11}
      viewBox="0 0 13 11"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M4.5 1.5h8m-8 4h8m-8 4h8" />
      <circle cx="1.5" cy="1.5" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1.5" cy="5.5" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1.5" cy="9.5" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

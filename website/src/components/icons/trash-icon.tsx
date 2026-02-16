import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function TrashIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={11}
      height={13}
      viewBox="0 0 11 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path d="M0.5 2.5H10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M1.5 2.5L1.9525 11.5499C1.97911 12.0821 2.41838 12.5 2.95125 12.5H8.04875C8.58162 12.5 9.02089 12.0821 9.0475 11.5499L9.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 5.5V9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 5.5V9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.5 2.5V1.5C3.5 0.947715 3.94772 0.5 4.5 0.5H6.6547C7.20699 0.5 7.6547 0.947715 7.6547 1.5V2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

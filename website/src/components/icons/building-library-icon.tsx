import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BuildingLibraryIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.500053 4.5L6.50005 0.5L12.5001 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1.50005 6.5V12.5H11.5001V6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.50005 3.5L6.50005 3.51" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.00005 6.5V10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.50005 6.5V10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.00005 6.5V10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

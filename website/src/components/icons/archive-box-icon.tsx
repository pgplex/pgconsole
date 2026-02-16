import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArchiveBoxIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 1.5C0.5 0.947715 0.947715 0.5 1.5 0.5H11.5C12.0523 0.5 12.5 0.947715 12.5 1.5V2.5C12.5 3.05228 12.0523 3.5 11.5 3.5H1.5C0.947715 3.5 0.5 3.05228 0.5 2.5V1.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 3.5H11.5V11.5C11.5 12.0523 11.0523 12.5 10.5 12.5H2.5C1.94772 12.5 1.5 12.0523 1.5 11.5V3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.5 5.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

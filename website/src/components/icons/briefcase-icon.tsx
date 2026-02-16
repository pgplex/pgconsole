import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BriefcaseIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M4.5 2.5V1.5C4.5 0.947715 4.94772 0.5 5.5 0.5H7.6547C8.20699 0.5 8.6547 0.947715 8.6547 1.5V2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 3.5C0.5 2.94772 0.947715 2.5 1.5 2.5H11.5C12.0523 2.5 12.5 2.94772 12.5 3.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H1.5C0.947715 8.5 0.5 8.05228 0.5 7.5V3.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 8.5V11.5C11.5 12.0523 11.0523 12.5 10.5 12.5H2.5C1.94772 12.5 1.5 12.0523 1.5 11.5V8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.5 8.5V9.5H7.5V8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

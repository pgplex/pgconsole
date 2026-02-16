import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ClipboardIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path
        d="M7.5 1.5H9.5C10.0523 1.5 10.5 1.94772 10.5 2.5V11.5C10.5 12.0523 10.0523 12.5 9.5 12.5H1.5C0.947716 12.5 0.5 12.0523 0.5 11.5V2.5C0.5 1.94772 0.947715 1.5 1.5 1.5H3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 5.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 7.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 9.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.5 1.5C3.5 0.947715 3.94772 0.5 4.5 0.5H6.5C7.05228 0.5 7.5 0.947715 7.5 1.5V2.5H3.5V1.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

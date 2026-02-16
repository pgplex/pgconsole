import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ChatBubbleRectangleEllipsisIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 1.5C0.5 0.947715 0.947715 0.5 1.5 0.5H11.5C12.0523 0.5 12.5 0.947715 12.5 1.5V8.5C12.5 9.05228 12.0523 9.5 11.5 9.5H7.5L4.5 12.5V9.5H1.5C0.947715 9.5 0.5 9.05228 0.5 8.5V1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 5L4.5 5.01" stroke="currentColor" strokeLinecap="round" />
      <path d="M6.5 5L6.5 5.01" stroke="currentColor" strokeLinecap="round" />
      <path d="M8.5 5L8.5 5.01" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function PhotoIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path
        d="M0.5 7.50879L4.5 3.50879L8.5 7.50879L10.5 5.50879L12.5 7.50879V10.5088H0.5V7.50879Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M0.5 1.5C0.5 0.947716 0.947715 0.5 1.5 0.5H11.5C12.0523 0.5 12.5 0.947715 12.5 1.5V9.5C12.5 10.0523 12.0523 10.5 11.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5V1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M0.5 7.5L4.5 3.5L8.5 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8.5L10.5 5.5L12.5 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8.5 3C8.5 3.27614 8.27614 3.5 8 3.5C7.72386 3.5 7.5 3.27614 7.5 3C7.5 2.72386 7.72386 2.5 8 2.5C8.27614 2.5 8.5 2.72386 8.5 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

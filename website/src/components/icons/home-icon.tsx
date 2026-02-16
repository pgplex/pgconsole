import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function HomeIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M4.5 8.5H8.5V12.5H4.5V8.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 6.5L6.5 0.5L12.5 6.5V12.5H8.5V8.5H4.5V12.5H0.5V6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

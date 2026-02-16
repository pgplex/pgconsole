import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function Square3Stack3dIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6.5 12.5L0.5 9.5L3.5 8L0.5 6.5L3.5 5L6.5 6.5L9.5 5L12.5 6.5L9.5 8L12.5 9.5L6.5 12.5Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M0.5 3.5L6.5 0.5L12.5 3.5L6.5 6.5L0.5 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 5L0.5 6.5L6.5 9.5L12.5 6.5L9.5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 8L0.5 9.5L6.5 12.5L12.5 9.5L9.5 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

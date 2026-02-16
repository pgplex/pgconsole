import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function SlidersIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M.5 1.5h7m-7 4h3m-3 4h7m2-8h3m-7 4h7m-3 4h3"
      />
      <path
        fill="currentColor"
        fillOpacity=".2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 1.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-4 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
      />
    </svg>
  )
}

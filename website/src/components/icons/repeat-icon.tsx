import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function RepeatIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 2.5H7.5C9.15685 2.5 10.5 3.84315 10.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 10.5H5.5C3.84315 10.5 2.5 9.15685 2.5 7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 0.5L0.5 2.5L2.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 12.5L12.5 10.5L10.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

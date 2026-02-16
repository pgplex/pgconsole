import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function LockIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 6.5C0.5 5.94772 0.947715 5.5 1.5 5.5H9.5C10.0523 5.5 10.5 5.94772 10.5 6.5V11.5C10.5 12.0523 10.0523 12.5 9.5 12.5H1.5C0.947716 12.5 0.5 12.0523 0.5 11.5V6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 5.5V3.5C8.5 1.84315 7.15685 0.5 5.5 0.5C3.84315 0.5 2.5 1.84315 2.5 3.5V5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

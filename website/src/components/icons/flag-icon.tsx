import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function FlagIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.5 1V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M2.64647 0.731691L0.5 1V8L2.64647 7.73169C3.87156 7.57855 5.11442 7.6536 6.31218 7.95304L6.68782 8.04696C7.88558 8.3464 9.12844 8.42145 10.3535 8.26831L12.5 8V1L10.3535 1.26831C9.12844 1.42145 7.88558 1.3464 6.68782 1.04696L6.31218 0.953045C5.11442 0.653605 3.87156 0.578555 2.64647 0.731691Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

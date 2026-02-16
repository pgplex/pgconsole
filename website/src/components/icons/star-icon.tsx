import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function StarIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="m6.5.5 1.347 4.146h4.36L8.68 7.208l1.347 4.146L6.5 8.792l-3.527 2.562L4.32 7.208.793 4.646h4.36L6.5.5Z"
      />
    </svg>
  )
}

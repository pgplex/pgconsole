import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function GitMergeIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M2.5 3.5V9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 2C4 2.82843 3.32843 3.5 2.5 3.5C1.67157 3.5 1 2.82843 1 2C1 1.17157 1.67157 0.5 2.5 0.5C3.32843 0.5 4 1.17157 4 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M10 6.5C10 7.32843 9.32843 8 8.5 8C7.67157 8 7 7.32843 7 6.5C7 5.67157 7.67157 5 8.5 5C9.32843 5 10 5.67157 10 6.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M4 11C4 11.8284 3.32843 12.5 2.5 12.5C1.67157 12.5 1 11.8284 1 11C1 10.1716 1.67157 9.5 2.5 9.5C3.32843 9.5 4 10.1716 4 11Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M7 6.5H5.5C3.84315 6.5 2.5 5.15685 2.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function NewspaperIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M9.5 3.5H12.5V11C12.5 11.8284 11.8284 12.5 11 12.5C10.1716 12.5 9.5 11.8284 9.5 11V3.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 3.5V0.5H0.5V10.5C0.5 11.6046 1.39543 12.5 2.5 12.5H10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 2.5H4.5V4.5H2.5V2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 2.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 4.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 6.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 8.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10.5H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

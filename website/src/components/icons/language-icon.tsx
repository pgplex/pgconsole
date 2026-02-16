import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function LanguageIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.5 1.5H8.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M4.5 0.5V1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 12.5L9 4.5L12.5 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 10.5H11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.29996 1.5C6.58287 5.03269 4.00349 7.88913 0.63116 9" stroke="currentColor" strokeLinecap="round" />
      <path
        d="M2.33209 3.5C3.0286 5.09415 4.12873 6.47161 5.5033 7.50321"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

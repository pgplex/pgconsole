import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ShieldExclamationIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6.5 1.21245C7.80503 2.0284 9.34744 2.5 11 2.5C11.4589 2.5 11.9093 2.46364 12.3484 2.39364C12.4479 2.91382 12.5 3.45083 12.5 4C12.5 7.82437 9.97434 11.0588 6.5 12.1264C3.02566 11.0588 0.5 7.82437 0.5 4C0.5 3.45083 0.552081 2.91382 0.651573 2.39364C1.09074 2.46364 1.54112 2.5 2 2.5C3.65256 2.5 5.19497 2.0284 6.5 1.21245Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 4.5V6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 8.5L6.5 8.51" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

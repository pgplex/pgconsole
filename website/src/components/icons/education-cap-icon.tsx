import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function EducationCapIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 4.5L6.5 0.5L12.5 4.5L6.5 8.5L0.5 4.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 12.5L2.5 9.83333V5.83333L6.5 8.5L10.5 5.83333V9.83333L6.5 12.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 8.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 4.5V8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

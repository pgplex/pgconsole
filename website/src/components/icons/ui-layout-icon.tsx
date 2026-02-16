import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function UiLayoutIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 1.5C0.5 0.947715 0.947715 0.5 1.5 0.5H11.5C12.0523 0.5 12.5 0.947715 12.5 1.5V11.5C12.5 12.0523 12.0523 12.5 11.5 12.5H1.5C0.947715 12.5 0.5 12.0523 0.5 11.5V1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path d="M0.5 4.5H12.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M4.5 4.5V12.5" stroke="currentColor" strokeLinecap="round" />
      <path
        d="M11.5 0.5C12.0523 0.5 12.5 0.947716 12.5 1.5V4.5L0.5 4.5L0.5 1.5C0.5 0.947715 0.947716 0.5 1.5 0.5L11.5 0.5Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  )
}

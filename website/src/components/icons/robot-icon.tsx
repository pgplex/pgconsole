import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function RobotIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M6.5 1.7V2.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="0.9" r="0.8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" />
      <rect
        x="2"
        y="2.7"
        width="9"
        height="8"
        rx="1.8"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 6H1V7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 6H12V7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4.8" cy="5.9" r="0.7" fill="currentColor" />
      <circle cx="8.2" cy="5.9" r="0.7" fill="currentColor" />
      <path d="M4.8 8.4H8.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

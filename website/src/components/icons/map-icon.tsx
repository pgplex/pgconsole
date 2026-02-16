import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function MapIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M8.5 2.5L4.5 0.500001V10.5L8.5 12.5V2.5Z" fill="currentColor" fillOpacity="0.2" />
      <path
        d="M0.5 2.5L4.5 0.500001L8.5 2.5L12.5 0.500001V10.5L8.5 12.5L4.5 10.5L0.5 12.5V2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 0.500001V10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 2.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

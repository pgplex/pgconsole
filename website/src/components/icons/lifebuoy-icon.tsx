import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function LifebuoyIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M5.5 0.5H7.5V4.5H5.5V0.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M12.5 5.5V7.5L8.5 7.5L8.5 5.5L12.5 5.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M5.5 8.5H7.5V12.5H5.5V8.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M4.5 5.5V7.5L0.5 7.5L0.5 5.5L4.5 5.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M5.5 1V4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5.5L8.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 8.5V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 5.5L1 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 1V4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.5L8.5 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8.5V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 7.5L1 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

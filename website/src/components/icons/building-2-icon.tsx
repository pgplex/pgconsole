import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function Building2Icon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M7.5 4.5H11.5V12.5H7.5V4.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M1.5 0.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 0.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 4.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 0.5H8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 4.5H12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 12.5H12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 12.5V8.5H5.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 6.49L3.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.49L3.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 2.49L3.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6.49L5.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 4.49L5.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 2.49L5.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 6.49L9.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 8.49L9.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10.49L9.5 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

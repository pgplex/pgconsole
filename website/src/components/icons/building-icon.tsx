import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BuildingIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M5.5 8.5V12.5H7.5V8.5H5.5Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M2.5 0.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 0.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 0.5H11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 2.5H5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4.5H5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 6.5H5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 2.5H8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 4.5H8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 6.5H8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 12.5H11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 12.5V8.5H7.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

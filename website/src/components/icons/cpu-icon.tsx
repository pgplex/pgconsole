import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CpuIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M1.5 2.5C1.5 1.94772 1.94772 1.5 2.5 1.5H10.5C11.0523 1.5 11.5 1.94772 11.5 2.5V10.5C11.5 11.0523 11.0523 11.5 10.5 11.5H2.5C1.94772 11.5 1.5 11.0523 1.5 10.5V2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 3.5H9.5V9.5H3.5V3.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 0.5V1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6.5L11.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 6.5L0.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 0.5V1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 8.5L11.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 11.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 8.5L0.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 0.5V1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 4.5L11.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 4.5L0.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

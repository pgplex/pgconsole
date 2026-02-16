import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function MicrophoneIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={9}
      height={13}
      viewBox="0 0 9 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M2.5 2.5C2.5 1.39543 3.39543 0.5 4.5 0.5C5.60457 0.5 6.5 1.39543 6.5 2.5V6.5C6.5 7.60457 5.60457 8.5 4.5 8.5C3.39543 8.5 2.5 7.60457 2.5 6.5V2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 6.5C0.5 8.70914 2.29086 10.5 4.5 10.5C6.70914 10.5 8.5 8.70914 8.5 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.50488 12.5L2.50488 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 10.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

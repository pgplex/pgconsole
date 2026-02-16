import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function DocumentIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={11}
      height={13}
      viewBox="0 0 11 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M0.5 12.5H10.5V4.5C10.5 2.29086 8.70914 0.5 6.5 0.5H0.5V12.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 6.5C10.5 5.39543 9.60457 4.5 8.5 4.5H6.5V2.5C6.5 1.39543 5.60457 0.5 4.5 0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 4.5V2.5C6.5 1.39543 5.60457 0.5 4.5 0.5H6.5C8.70914 0.5 10.5 2.29086 10.5 4.5V6.5C10.5 5.39543 9.60457 4.5 8.5 4.5H6.5Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  )
}

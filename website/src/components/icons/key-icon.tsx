import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function KeyIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M8.5 8.5C10.7091 8.5 12.5 6.70914 12.5 4.5C12.5 2.29086 10.7091 0.5 8.5 0.5C6.29086 0.5 4.5 2.29086 4.5 4.5C4.5 5.08694 4.62642 5.64435 4.8535 6.1465L0.5 10.5V12.5H2.5V11.5H3.5V10.5H4.5L6.8535 8.1465C7.35565 8.37358 7.91306 8.5 8.5 8.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 4.5C10.5 3.39543 9.60457 2.5 8.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

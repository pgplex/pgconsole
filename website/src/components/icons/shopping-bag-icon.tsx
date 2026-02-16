import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ShoppingBagIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M1.5 4.5H11.5L12.5 12.5H0.500003L1.5 4.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 7.5V3.5C3.5 1.84315 4.84315 0.5 6.5 0.5C8.15686 0.5 9.5 1.84315 9.5 3.5V7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

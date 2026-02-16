import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CloudArrowDownIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M3.5 9.5C1.84315 9.5 0.5 8.15685 0.5 6.5C0.5 5.19203 1.33704 4.07957 2.50468 3.66905C2.50157 3.6131 2.5 3.55673 2.5 3.5C2.5 1.84315 3.84315 0.5 5.5 0.5C6.85669 0.5 8.00305 1.40057 8.37387 2.63653C8.56443 2.54888 8.77651 2.5 9 2.5C9.82843 2.5 10.5 3.17157 10.5 4C10.5 4.18745 10.4656 4.36686 10.4028 4.53228C11.592 4.72491 12.5 5.75642 12.5 7C12.5 8.38071 11.3807 9.5 10 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.50977 12.5L6.50977 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.50488 10.4951L6.50488 12.4951L8.50488 10.4951"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

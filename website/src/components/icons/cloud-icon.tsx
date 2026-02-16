import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CloudIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={11}
      viewBox="0 0 13 11"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M0.5 6.5C0.5 8.15685 1.84315 9.5 3.5 9.5H10C11.3807 9.5 12.5 8.38071 12.5 7C12.5 5.75642 11.592 4.72491 10.4028 4.53228C10.4656 4.36686 10.5 4.18745 10.5 4C10.5 3.17157 9.82843 2.5 9 2.5C8.77651 2.5 8.56443 2.54888 8.37387 2.63653C8.00305 1.40057 6.85669 0.5 5.5 0.5C3.84315 0.5 2.5 1.84315 2.5 3.5C2.5 3.55673 2.50157 3.6131 2.50468 3.66905C1.33704 4.07957 0.5 5.19203 0.5 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

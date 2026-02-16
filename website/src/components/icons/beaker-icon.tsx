import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BeakerIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.5 12.5049H12.5V10.5049L10.5 7.50488H2.5L0.5 10.5049V12.5049Z" fill="currentColor" fillOpacity="0.2" />
      <path
        d="M4.5 0.504883H8.5V4.20211C8.5 4.39953 8.55844 4.59254 8.66795 4.75681L12.2422 10.1181C12.4103 10.3703 12.5 10.6666 12.5 10.9697C12.5 11.8176 11.8127 12.5049 10.9648 12.5049H2.03518C1.18733 12.5049 0.5 11.8176 0.5 10.9697C0.5 10.6666 0.589713 10.3703 0.757834 10.1181L4.33205 4.75681C4.44156 4.59254 4.5 4.39953 4.5 4.20211V0.504883Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 7.50488H10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.50488 0.5L3.50488 0.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ArrowLeftArrowRightIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.504883 3.50488L12.5049 3.50488" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5049 9.49512L0.504883 9.49512" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.50976 0.5L0.509765 3.5L3.50977 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 12.5L12.5 9.5L9.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

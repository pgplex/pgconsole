import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ShoppingCartIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.5 0.5H2.5L3.5 9.5H11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.50005 7.5H11.7222L12.3889 1.5H3.00005"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 12C4.5 12.2761 4.27614 12.5 4 12.5C3.72386 12.5 3.5 12.2761 3.5 12C3.5 11.7239 3.72386 11.5 4 11.5C4.27614 11.5 4.5 11.7239 4.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M11.5 12C11.5 12.2761 11.2761 12.5 11 12.5C10.7239 12.5 10.5 12.2761 10.5 12C10.5 11.7239 10.7239 11.5 11 11.5C11.2761 11.5 11.5 11.7239 11.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

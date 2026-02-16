import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BanknotesIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M0.5 0.5H12.5V7.5H0.5V0.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8 4C8 4.82843 7.32843 5.5 6.5 5.5C5.67157 5.5 5 4.82843 5 4C5 3.17157 5.67157 2.5 6.5 2.5C7.32843 2.5 8 3.17157 8 4Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 9.5C3.91327 9.5 7.25521 9.80537 10.5 10.3903V9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 6.5C1.05228 6.5 1.5 6.94772 1.5 7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 7.5C11.5 6.94772 11.9477 6.5 12.5 6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 0.5C11.5 1.05228 11.9477 1.5 12.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 0.5C1.5 1.05228 1.05228 1.5 0.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 3.99978L10 4.00978" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3.99977L3 4.00977" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

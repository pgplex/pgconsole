import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function GitDiffIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6.50488 2.50488H8.50488C9.60945 2.50488 10.5049 3.40031 10.5049 4.50488V9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.50977 0.5L6.50976 2.5L8.50977 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11C12 11.8284 11.3284 12.5 10.5 12.5C9.67157 12.5 9 11.8284 9 11C9 10.1716 9.67157 9.5 10.5 9.5C11.3284 9.5 12 10.1716 12 11Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M6.49512 10.4951L4.49512 10.4951C3.39055 10.4951 2.49512 9.59969 2.49512 8.49512L2.49512 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.49023 12.5L6.49024 10.5L4.49023 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 2C1 1.17157 1.67157 0.5 2.5 0.5C3.32843 0.5 4 1.17157 4 2C4 2.82843 3.32843 3.5 2.5 3.5C1.67157 3.5 1 2.82843 1 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

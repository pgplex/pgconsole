import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function GitPullIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <path d="M2.5 3.5V9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8.50976 0.5L6.50976 2.5L8.50977 4.5"
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
        d="M4 2C4 2.82843 3.32843 3.5 2.5 3.5C1.67157 3.5 1 2.82843 1 2C1 1.17157 1.67157 0.5 2.5 0.5C3.32843 0.5 4 1.17157 4 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M4 11C4 11.8284 3.32843 12.5 2.5 12.5C1.67157 12.5 1 11.8284 1 11C1 10.1716 1.67157 9.5 2.5 9.5C3.32843 9.5 4 10.1716 4 11Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

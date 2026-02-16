import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function User2Icon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6.5 2.5C6.5 3.60457 5.60457 4.5 4.5 4.5C3.39543 4.5 2.5 3.60457 2.5 2.5C2.5 1.39543 3.39543 0.5 4.5 0.5C5.60457 0.5 6.5 1.39543 6.5 2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 4C11.5 4.82843 10.8284 5.5 10 5.5C9.17157 5.5 8.5 4.82843 8.5 4C8.5 3.17157 9.17157 2.5 10 2.5C10.8284 2.5 11.5 3.17157 11.5 4Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10.5H0.5C0.5 8.29086 2.29086 6.5 4.5 6.5C6.70914 6.5 8.5 8.29086 8.5 10.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.97998 8.52659C8.43471 7.90427 9.17008 7.5 9.99986 7.5C11.3806 7.5 12.4999 8.61929 12.4999 10V10.5H8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function MoonIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 6.5C0.5 9.81371 3.18629 12.5 6.5 12.5C8.9333 12.5 11.0283 11.0515 11.9697 8.96974C11.2165 9.31038 10.3804 9.5 9.5 9.5C6.18629 9.5 3.5 6.81371 3.5 3.5C3.5 2.61959 3.68962 1.78347 4.03026 1.03026C1.94849 1.97171 0.5 4.0667 0.5 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

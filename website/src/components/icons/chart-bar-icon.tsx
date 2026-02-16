import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ChartBarIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={9}
      height={13}
      viewBox="0 0 9 13"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path stroke="currentColor" strokeLinecap="round" d="M.5 9.5v3M4.5 5v7.5M8.5.5v12" />
    </svg>
  )
}

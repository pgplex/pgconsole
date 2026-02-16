import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ChartPieCircleIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        fill="#000"
        fillOpacity=".2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 10.5a4 4 0 0 0 0-8v4L3.67 9.328A3.987 3.987 0 0 0 6.5 10.5Z"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function SunIcon({ className, ...props }: ComponentProps<'svg'>) {
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
      <circle cx="6.5" cy="6.5" r="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5.5v1m4.244.754-.707.707m2.468 3.534h-1m-.754 4.245-.707-.708M6.5 11.5v1m-3.534-2.468-.707.707m-.754-4.244h-1m2.468-3.534-.707-.707"
      />
    </svg>
  )
}

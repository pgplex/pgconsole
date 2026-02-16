import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function InboxIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 13 13"
      fill="none"
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        fill="currentColor"
        fillOpacity=".2"
        d="M1.5 11.5h10a1 1 0 0 0 1-1v-3h-3a1 1 0 0 0-1 1 1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1 1 1 0 0 0-1-1h-3v3a1 1 0 0 0 1 1"
      />
      <path
        stroke="currentColor"
        d="M.5 7.5v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3m-12 0 1.772-5.316a1 1 0 0 1 .949-.684h6.558a1 1 0 0 1 .949.684L12.5 7.5m-12 0h3a1 1 0 0 1 1 1 1 1 0 0 0 1 1h2a1 1 0 0 0 1-1 1 1 0 0 1 1-1h3"
      />
    </svg>
  )
}

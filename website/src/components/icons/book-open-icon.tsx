import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BookOpenIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        stroke="currentColor"
        strokeLinejoin="round"
        d="M.5 1.5h4.293A1.707 1.707 0 0 1 6.5 3.207V11.5l-.414-.414a2 2 0 0 0-1.414-.586H.5v-9Z"
      />
      <path
        fill="currentColor"
        fillOpacity=".2"
        stroke="currentColor"
        strokeLinejoin="round"
        d="M12.5 1.5H8.207A1.707 1.707 0 0 0 6.5 3.207V11.5l.414-.414a2 2 0 0 1 1.414-.586H12.5v-9Z"
      />
    </svg>
  )
}

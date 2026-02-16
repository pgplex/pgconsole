import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function UserArrowLeftIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M8.5 2.5C8.5 3.60457 7.60457 4.5 6.5 4.5C5.39543 4.5 4.5 3.60457 4.5 2.5C4.5 1.39543 5.39543 0.5 6.5 0.5C7.60457 0.5 8.5 1.39543 8.5 2.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 12.5H0.5V9.20835C1.96589 7.54751 4.11061 6.5 6.5 6.5C7.95715 6.5 9.32331 6.88958 10.5 7.57026"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.5 11H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9.5L7.5 11L9 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

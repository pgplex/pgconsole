import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BellIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M1.51198 8.40414L2.00386 4.46911C2.2873 2.2016 4.21485 0.5 6.5 0.5C8.78515 0.5 10.7127 2.2016 10.9961 4.46911L11.488 8.40414C11.4959 8.46759 11.5146 8.52922 11.5432 8.5864L12.5 10.5H0.500001L1.4568 8.5864C1.48539 8.52922 1.50405 8.46759 1.51198 8.40414Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 12.5C7.60457 12.5 8.5 11.6046 8.5 10.5H4.5C4.5 11.6046 5.39543 12.5 6.5 12.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

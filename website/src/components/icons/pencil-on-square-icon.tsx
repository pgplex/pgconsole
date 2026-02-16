import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function PencilOnSquareIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6 1.5H2.5C1.39543 1.5 0.5 2.39543 0.5 3.5V10.5C0.5 11.6046 1.39543 12.5 2.5 12.5H9.5C10.6046 12.5 11.5 11.6046 11.5 10.5V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 7.41421V8.5H5.58579C5.851 8.5 6.10536 8.39464 6.29289 8.20711L11.75 2.75C12.1642 2.33579 12.1642 1.66421 11.75 1.25C11.3358 0.835787 10.6642 0.835787 10.25 1.25L4.79289 6.70711C4.60536 6.89464 4.5 7.149 4.5 7.41421Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

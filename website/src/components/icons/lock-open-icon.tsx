import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function LockOpenIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={11}
      height={13}
      viewBox="0 0 11 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M0.5 6.50004C0.5 5.94775 0.947715 5.50004 1.5 5.50004H9.5C10.0523 5.50004 10.5 5.94775 10.5 6.50004V11.5C10.5 12.0523 10.0523 12.5 9.5 12.5H1.5C0.947716 12.5 0.5 12.0523 0.5 11.5V6.50004Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.62132 1.37868C6.44975 0.207107 4.55025 0.207107 3.37868 1.37868C2.79288 1.96448 2.49999 2.73226 2.5 3.50004L2.5 5.50004"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function HeartIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.5 3.99997C12.5 2.34312 11.1009 0.999971 9.375 0.999971C8.08459 0.999971 6.97685 1.75082 6.5 2.82225C6.02315 1.75082 4.91541 0.999971 3.625 0.999971C1.89911 0.999971 0.5 2.34312 0.5 3.99997C0.5 8.81368 6.5 12 6.5 12C6.5 12 12.5 8.81368 12.5 3.99997Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

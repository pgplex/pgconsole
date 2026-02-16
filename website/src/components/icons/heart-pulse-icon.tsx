import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function HeartPulseIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.5 4C12.5 2.34315 11.1009 1 9.375 1C8.08459 1 6.97685 1.75085 6.5 2.82228C6.02315 1.75085 4.91541 1 3.625 1C1.89911 1 0.5 2.34315 0.5 4C0.5 5.29445 0.933875 6.47122 1.56828 7.5H3.5L5 4.5L6.5 8.5L8 5.5L9 7.5H11.4317C12.0661 6.47122 12.5 5.29445 12.5 4Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3.99997C12.5 2.34312 11.1009 0.999971 9.375 0.999971C8.08459 0.999971 6.97685 1.75082 6.5 2.82225C6.02315 1.75082 4.91541 0.999971 3.625 0.999971C1.89911 0.999971 0.5 2.34312 0.5 3.99997C0.5 8.81368 6.5 12 6.5 12C6.5 12 12.5 8.81368 12.5 3.99997Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 7.5H3.5L5 4.5L6.5 8.5L8 5.5L9 7.5H12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

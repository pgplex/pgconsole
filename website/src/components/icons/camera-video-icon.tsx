import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CameraVideoIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={9}
      viewBox="0 0 13 9"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M0.5 1.5C0.5 0.947715 0.947715 0.5 1.5 0.5H7.5C8.05229 0.5 8.5 0.947715 8.5 1.5V7.5C8.5 8.05229 8.05229 8.5 7.5 8.5H1.5C0.947715 8.5 0.5 8.05229 0.5 7.5V1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M12.5 7.5V1.5L8.5 3.5V5.5L12.5 7.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

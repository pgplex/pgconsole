import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function ChartLineIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={11}
      viewBox="0 0 13 11"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M0.5 1.5C0.5 0.947716 0.947715 0.5 1.5 0.5H11.5C12.0523 0.5 12.5 0.947715 12.5 1.5V9.5C12.5 10.0523 12.0523 10.5 11.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5V1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 9.49997V1.49997C12.5 1.29247 12.4368 1.09972 12.3286 0.939941L7.99998 6.99997L4.99998 3.99997L0.671387 10.06C0.851174 10.3255 1.1552 10.5 1.49998 10.5H11.5C12.0523 10.5 12.5 10.0523 12.5 9.49997Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.3286 0.939941L7.99998 6.99997L4.99998 3.99997L0.671387 10.06"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

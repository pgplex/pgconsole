import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function PaperclipIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M5.62132 11.6213C4.44975 12.7929 2.55025 12.7929 1.37868 11.6213C0.207107 10.4497 0.207107 8.55025 1.37868 7.37868L7.37868 1.37868C8.55025 0.207107 10.4497 0.207107 11.6213 1.37868C12.7929 2.55025 12.7929 4.44975 11.6213 5.62132L8.68198 8.56066C8.09619 9.14645 7.14645 9.14645 6.56066 8.56066C5.97487 7.97487 5.97487 7.02513 6.56066 6.43934L9.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function SparklesIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        d="M3.124 5.004 4 1.5l.876 3.504a1 1 0 0 0 .5987.6859L7.5 6.5l-2.0253.8101a1 1 0 0 0-.5987.686L4 11.5l-.876-3.504a1 1 0 0 0-.5987-.6859L.5 6.5l2.0253-.8101a1 1 0 0 0 .5987-.686ZM9.6455 1.918 10 .5l.3545 1.418a.9998.9998 0 0 0 .7276.7275L12.5 3l-1.4179.3545a1 1 0 0 0-.7276.7276L10 5.5l-.3545-1.418a1 1 0 0 0-.7276-.7275L7.5 3l1.418-.3545a1 1 0 0 0 .7275-.7276ZM8.649 10.2019 9 9.5l.351.7019c.0967.1935.2536.3504.4471.4472L10.5 11l-.7019.3509a1.0002 1.0002 0 0 0-.4472.4472L9 12.5l-.351-.7019a1.0002 1.0002 0 0 0-.4471-.4472L7.5 11l.7019-.3509a1.0002 1.0002 0 0 0 .4472-.4472Z"
      />
    </svg>
  )
}

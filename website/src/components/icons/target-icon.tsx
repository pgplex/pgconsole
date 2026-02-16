import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function TargetIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M9.5 2.5L10.5 1.5V2.5H11.5L10.5 3.5H9.5V2.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 6.5L9.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.37523 4.50383C5.32878 4.56824 4.5 5.43733 4.5 6.5C4.5 7.60457 5.39543 8.5 6.5 8.5C7.56255 8.5 8.43158 7.67139 8.49615 6.6251"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2092 5C10.3967 5.46322 10.5 5.96955 10.5 6.5C10.5 8.70914 8.70914 10.5 6.5 10.5C4.29086 10.5 2.5 8.70914 2.5 6.5C2.5 4.29086 4.29086 2.5 6.5 2.5C7.03045 2.5 7.53678 2.60325 8 2.79076"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.0069 4.11417C12.3241 4.84539 12.5 5.65216 12.5 6.5C12.5 9.81371 9.81371 12.5 6.5 12.5C3.18629 12.5 0.5 9.81371 0.5 6.5C0.5 3.18629 3.18629 0.5 6.5 0.5C7.34784 0.5 8.15461 0.675855 8.88583 0.993081"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

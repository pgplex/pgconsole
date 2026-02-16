import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function FingerprintIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M6.5 6.5C6.5 9.81371 3.81371 12.5 0.5 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 6.5C0.5 5.40714 0.792183 4.38252 1.30269 3.5M10.8946 12.5C11.9156 10.735 12.5 8.68572 12.5 6.5C12.5 3.18629 9.81371 0.5 6.5 0.5C5.27326 0.5 4.13251 0.868153 3.1822 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 9.5C2.15685 9.5 3.5 8.15685 3.5 6.5C3.5 4.84315 4.84315 3.5 6.5 3.5C8.15685 3.5 9.5 4.84315 9.5 6.5M7.20832 12.5C8.20846 11.3826 8.9335 10.0137 9.27698 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

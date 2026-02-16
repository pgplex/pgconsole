import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function HardDriveIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M2.27208 1.18377C2.40819 0.77543 2.79033 0.5 3.22076 0.5H9.77924C10.2097 0.5 10.5918 0.77543 10.7279 1.18377L12.2947 5.8842C12.4307 6.29207 12.5 6.71918 12.5 7.14911V9.5C12.5 10.0523 12.0523 10.5 11.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5V7.14911C0.5 6.71918 0.569312 6.29207 0.705267 5.8842L2.27208 1.18377Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 7.5C0.5 6.94772 0.947715 6.5 1.5 6.5H11.5C12.0523 6.5 12.5 6.94772 12.5 7.5V9.5C12.5 10.0523 12.0523 10.5 11.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5V7.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 8.5L10.5 8.51" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 8.5L8.5 8.51" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

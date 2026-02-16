import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function LightBulbIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={9}
      height={13}
      viewBox="0 0 9 13"
      fill="none"
      strokeWidth={1}
      role="image"
      className={clsx('inline-block', className)}
      {...props}
    >
      <path
        d="M6.5 9.5V8.54166C6.5 8.1847 6.69665 7.86235 6.97681 7.64113C7.90455 6.9086 8.5 5.77384 8.5 4.5C8.5 2.29086 6.70914 0.5 4.5 0.5C2.29086 0.5 0.5 2.29086 0.5 4.5C0.5 5.77384 1.09545 6.9086 2.02319 7.64113C2.30335 7.86235 2.5 8.1847 2.5 8.54166V9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 12.5H5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11H6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 9.5V6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 5.5L4.5 6.5L5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

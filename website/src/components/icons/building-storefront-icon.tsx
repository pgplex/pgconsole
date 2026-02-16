import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function BuildingStorefrontIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M1.23223 1.23212C0.255922 2.20843 0.255922 3.79135 1.23223 4.76766C2.20262 5.73805 3.77228 5.74393 4.74994 4.78531C5.20088 5.2274 5.81861 5.5 6.5 5.5C7.18139 5.5 7.79912 5.2274 8.25006 4.78531C9.22772 5.74393 10.7974 5.73805 11.7678 4.76766C12.7441 3.79135 12.7441 2.20843 11.7678 1.23212L11.0356 0.5H1.96436L1.23223 1.23212Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.5 5.00029V12.5H1.5V5.00029" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 12.5V7.5H9.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 7.5V9.5H5.5V7.5H3.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

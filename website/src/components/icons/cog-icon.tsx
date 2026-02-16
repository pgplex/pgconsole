import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CogIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.78027 2.18555C8.4682 2.38937 9.08648 2.75364 9.59375 3.23438L11.1963 2.63379L12.1963 4.36621L10.876 5.45215C10.9562 5.78846 11 6.13911 11 6.5C11 6.86056 10.9561 7.21084 10.876 7.54688L12.1963 8.63379L11.1963 10.3662L9.59375 9.76465C9.08645 10.2456 8.46831 10.6096 7.78027 10.8135L7.5 12.5H5.5L5.21875 10.8135C4.53084 10.6095 3.91245 10.2456 3.40527 9.76465L1.80371 10.3662L0.803711 8.63379L2.12305 7.54688C2.04299 7.21091 2 6.86048 2 6.5C2 6.13919 2.04285 5.78839 2.12305 5.45215L0.803711 4.36621L1.80371 2.63379L3.40527 3.23438C3.91242 2.75361 4.53095 2.38949 5.21875 2.18555L5.5 0.5H7.5L7.78027 2.18555ZM6.5 4.5C5.39543 4.5 4.5 5.39543 4.5 6.5C4.5 7.60457 5.39543 8.5 6.5 8.5C7.60457 8.5 8.5 7.60457 8.5 6.5C8.5 5.39543 7.60457 4.5 6.5 4.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

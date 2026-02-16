import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function QuestionCircleIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.5 6.5C12.5 9.81371 9.81371 12.5 6.5 12.5C3.18629 12.5 0.5 9.81371 0.5 6.5C0.5 3.18629 3.18629 0.5 6.5 0.5C9.81371 0.5 12.5 3.18629 12.5 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.17161 3.67149C5.95266 2.89044 7.21899 2.89044 8.00004 3.67149C8.78108 4.45254 8.78108 5.71887 8.00004 6.49992C7.86171 6.63824 7.70817 6.75207 7.5448 6.84139C7.06022 7.10635 6.58582 7.53361 6.58582 8.08589"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 9.98977L6.5 9.99977" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function FilterIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M1.08579 3.08579C0.710713 2.71071 0.5 2.20201 0.5 1.67157V0.5H12.5V1.67157C12.5 2.20201 12.2893 2.71071 11.9142 3.08579L8.08579 6.91421C7.71071 7.28929 7.5 7.79799 7.5 8.32843V10.5L5.5 12.5V8.32843C5.5 7.79799 5.28929 7.28929 4.91421 6.91421L1.08579 3.08579Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

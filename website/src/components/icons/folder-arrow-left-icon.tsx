import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function FolderArrowLeftIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.5 6.5V3.5C12.5 2.94772 12.0523 2.5 11.5 2.5H7.91421C7.649 2.5 7.39464 2.39464 7.20711 2.20711L5.79289 0.792893C5.60536 0.605357 5.351 0.5 5.08579 0.5H1.5C0.947715 0.5 0.5 0.947716 0.5 1.5V9.5C0.5 10.0523 0.947715 10.5 1.5 10.5H5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.08594 0.5C5.3511 0.50004 5.60547 0.605468 5.79297 0.792969L7.20703 2.20703C7.39453 2.39453 7.6489 2.49996 7.91406 2.5H11.5C12.0523 2.5 12.5 2.94772 12.5 3.5V5.5C12.5 4.94772 12.0523 4.5 11.5 4.5H1.5C0.947715 4.5 0.5 4.94772 0.5 5.5V1.5C0.5 0.947715 0.947715 0.5 1.5 0.5H5.08594Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M5.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5V5.5C0.5 4.94772 0.947715 4.5 1.5 4.5H11.5C12.0523 4.5 12.5 4.94772 12.5 5.5V6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.5 9H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7.5L7.5 9L9 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

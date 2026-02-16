import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function FolderPlusIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.5 7.5V4.5C12.5 3.94772 12.0523 3.5 11.5 3.5H7.91421C7.649 3.5 7.39464 3.39464 7.20711 3.20711L5.79289 1.79289C5.60536 1.60536 5.351 1.5 5.08579 1.5H1.5C0.947715 1.5 0.5 1.94772 0.5 2.5V10.5C0.5 11.0523 0.947715 11.5 1.5 11.5H5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.08594 1.5C5.3511 1.50004 5.60547 1.60547 5.79297 1.79297L7.20703 3.20703C7.39453 3.39453 7.6489 3.49996 7.91406 3.5H11.5C12.0523 3.5 12.5 3.94772 12.5 4.5V6.5C12.5 5.94772 12.0523 5.5 11.5 5.5H1.5C0.947715 5.5 0.5 5.94772 0.5 6.5V2.5C0.5 1.94772 0.947715 1.5 1.5 1.5H5.08594Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M6.5 11.5H1.5C0.947715 11.5 0.5 11.0523 0.5 10.5V6.5C0.5 5.94772 0.947715 5.5 1.5 5.5H11.5C12.0523 5.5 12.5 5.94772 12.5 6.5V7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 8.5V12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.505 10.495L8.505 10.495" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

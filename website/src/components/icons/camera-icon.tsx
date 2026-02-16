import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function CameraIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M0.5 9.5V3.5C0.5 2.94772 0.947715 2.5 1.5 2.5H2.88197C3.26074 2.5 3.607 2.286 3.77639 1.94721L4.22361 1.05279C4.393 0.714002 4.73926 0.5 5.11803 0.5H7.88197C8.26074 0.5 8.607 0.714002 8.77639 1.05279L9.22361 1.94721C9.393 2.286 9.73926 2.5 10.118 2.5H11.5C12.0523 2.5 12.5 2.94772 12.5 3.5V9.5C12.5 10.0523 12.0523 10.5 11.5 10.5H1.5C0.947715 10.5 0.5 10.0523 0.5 9.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 6C9 7.38071 7.88071 8.5 6.5 8.5C5.11929 8.5 4 7.38071 4 6C4 4.61929 5.11929 3.5 6.5 3.5C7.88071 3.5 9 4.61929 9 6Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1.5 2.5V1.5H2.5V2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

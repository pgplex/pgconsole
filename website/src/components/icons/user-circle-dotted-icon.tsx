import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function UserCircleDottedIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M8.5 4.5C8.5 5.60457 7.60457 6.5 6.5 6.5C5.39543 6.5 4.5 5.60457 4.5 4.5C4.5 3.39543 5.39543 2.5 6.5 2.5C7.60457 2.5 8.5 3.39543 8.5 4.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5C12.5 9.81371 9.81371 12.5 6.5 12.5C3.18629 12.5 0.5 9.81371 0.5 6.5C0.5 3.18629 3.18629 0.5 6.5 0.5C9.81371 0.5 12.5 3.18629 12.5 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 2"
      />
      <path
        d="M10.6996 10.7853C9.8087 9.40999 8.26062 8.5 6.5 8.5C4.73938 8.5 3.1913 9.40999 2.30044 10.7853"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

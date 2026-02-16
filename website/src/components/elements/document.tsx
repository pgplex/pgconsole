import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function Document({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={clsx(
        'space-y-4 text-sm/7 text-mist-700 dark:text-mist-400 [&_a]:font-semibold [&_a]:text-mist-950 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-white [&_h2]:text-base/8 [&_h2]:font-medium [&_h2]:text-mist-950 [&_h2]:not-first:mt-8 dark:[&_h2]:text-white [&_li]:pl-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_strong]:text-mist-950 dark:[&_strong]:text-white [&_ul]:list-[square] [&_ul]:pl-6 [&_ul]:marker:text-mist-400 dark:[&_ul]:marker:text-mist-600',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

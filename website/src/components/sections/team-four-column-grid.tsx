import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Section } from '../elements/section'

export function TeamMember({
  img,
  name,
  byline,
  className,
  ...props
}: {
  img: ReactNode
  name: ReactNode
  byline: ReactNode
} & ComponentProps<'li'>) {
  return (
    <li className={clsx('flex flex-col gap-4 text-sm/7', className)} {...props}>
      <div className="aspect-3/4 w-full overflow-hidden rounded-sm outline -outline-offset-1 outline-black/5 *:size-full *:object-cover dark:outline-white/5">
        {img}
      </div>
      <div>
        <p className="font-semibold text-mist-950 dark:text-white">{name}</p>
        <p className="text-mist-700 dark:text-mist-400">{byline}</p>
      </div>
    </li>
  )
}

export function TeamFourColumnGrid({ children, ...props }: ComponentProps<typeof Section>) {
  return (
    <Section {...props}>
      <ul role="list" className="grid grid-cols-2 gap-x-2 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {children}
      </ul>
    </Section>
  )
}

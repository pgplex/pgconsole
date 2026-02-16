import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Section } from '../elements/section'

export function Feature({
  icon,
  headline,
  subheadline,
  className,
  ...props
}: {
  icon?: ReactNode
  headline: ReactNode
  subheadline: ReactNode
} & ComponentProps<'div'>) {
  return (
    <div className={clsx('flex flex-col gap-2 text-sm/7', className)} {...props}>
      <div className="flex items-center gap-3 text-mist-950 dark:text-white">
        {icon && <div className="size-3.25 h-lh">{icon}</div>}
        <h3 className="font-semibold">{headline}</h3>
      </div>
      <div className="flex flex-col gap-4 text-mist-700 dark:text-mist-400">{subheadline}</div>
    </div>
  )
}

export function FeaturesWithLargeDemo({
  demo,
  features,
  ...props
}: {
  demo?: ReactNode
  features: ReactNode
} & Omit<ComponentProps<typeof Section>, 'children'>) {
  return (
    <Section {...props}>
      <div className="flex flex-col gap-14">
        <div className="flex flex-col gap-32">{demo}</div>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">{features}</div>
      </div>
    </Section>
  )
}

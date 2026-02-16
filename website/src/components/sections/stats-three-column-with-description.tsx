import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'
import { Subheading } from '../elements/subheading'

export function Stat({
  stat,
  text,
  className,
  ...props
}: { stat: ReactNode; text: ReactNode } & ComponentProps<'div'>) {
  return (
    <div className={clsx('rounded-xl bg-mist-950/2.5 p-6 dark:bg-white/5', className)} {...props}>
      <div className="text-2xl/10 tracking-tight text-mist-950 dark:text-white">{stat}</div>
      <p className="mt-2 text-sm/7 text-mist-700 dark:text-mist-400">{text}</p>
    </div>
  )
}

export function StatsThreeColumnWithDescription({
  heading,
  description,
  children,
  className,
  ...props
}: {
  heading: ReactNode
  description: ReactNode
} & ComponentProps<'section'>) {
  return (
    <section className={clsx('py-16', className)} {...props}>
      <Container>
        <div className="relative flex flex-col gap-10 sm:gap-16">
          <hr className="absolute inset-x-0 -top-16 border-t border-mist-950/10 dark:border-white/10" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Subheading>{heading}</Subheading>
            <div className="flex max-w-xl flex-col gap-4 text-base/7 text-mist-700 dark:text-mist-400">
              {description}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">{children}</div>
        </div>
      </Container>
    </section>
  )
}

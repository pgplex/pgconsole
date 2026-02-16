import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'
import { Subheading } from '../elements/subheading'
import { Text } from '../elements/text'
import { CheckmarkIcon } from '../icons/checkmark-icon'

export function PricingSingleTierTwoColumn({
  headline,
  subheadline,
  price,
  period,
  features,
  cta,
  className,
  ...props
}: {
  headline: ReactNode
  subheadline: ReactNode
  price: ReactNode
  period?: ReactNode
  features: ReactNode[]
  cta: ReactNode
} & ComponentProps<'section'>) {
  return (
    <section className={clsx('py-16', className)} {...props}>
      <Container>
        <div className="grid grid-cols-1 gap-x-2 rounded-xl bg-mist-950/2.5 p-2 lg:grid-cols-2 dark:bg-white/5">
          <div className="flex flex-col items-start justify-between gap-10 p-6 sm:p-10">
            <div className="flex flex-col gap-6">
              <Subheading>{headline}</Subheading>
              <Text className="flex flex-col gap-4 text-pretty">{subheadline}</Text>
            </div>
            {cta}
          </div>
          <div className="rounded-sm bg-mist-100 p-6 sm:p-10 dark:bg-mist-950">
            <div className="flex items-baseline gap-2">
              <p className="text-[5rem]/24 font-light tracking-tight text-mist-950 sm:text-8xl/32 dark:text-white">
                {price}
              </p>
              <Text size="lg">{period}</Text>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
              {features.map((feature, index) => (
                <li key={index} className="flex gap-3 text-sm/5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-xs bg-mist-950 dark:bg-mist-700">
                    <CheckmarkIcon className="size-3 stroke-white" />
                  </span>
                  <p className="text-mist-700 dark:text-mist-400">{feature}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}

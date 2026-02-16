import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'
import { Heading } from '../elements/heading'
import { Text } from '../elements/text'

export function HeroSimpleLeftAligned({
  eyebrow,
  headline,
  subheadline,
  cta,
  className,
  ...props
}: {
  eyebrow?: ReactNode
  headline: ReactNode
  subheadline: ReactNode
  cta?: ReactNode
} & ComponentProps<'section'>) {
  return (
    <section className={clsx('py-16', className)} {...props}>
      <Container className="flex flex-col items-start gap-6">
        {eyebrow}
        <Heading>{headline}</Heading>
        <Text size="lg" className="flex max-w-xl flex-col gap-4">
          {subheadline}
        </Text>
        {cta}
      </Container>
    </section>
  )
}

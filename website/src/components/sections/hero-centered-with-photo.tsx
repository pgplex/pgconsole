import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'
import { Heading } from '../elements/heading'
import { Text } from '../elements/text'

export function HeroCenteredWithPhoto({
  eyebrow,
  headline,
  subheadline,
  cta,
  photo,
  footer,
  className,
  ...props
}: {
  eyebrow?: ReactNode
  headline: ReactNode
  subheadline: ReactNode
  cta?: ReactNode
  photo?: ReactNode
  footer?: ReactNode
} & ComponentProps<'section'>) {
  return (
    <section className={clsx('py-16', className)} {...props}>
      <Container className="flex flex-col gap-16">
        <div className="flex flex-col gap-32">
          <div className="flex flex-col items-center gap-6">
            {eyebrow}
            <Heading className="max-w-5xl text-center">{headline}</Heading>
            <Text size="lg" className="flex max-w-3xl flex-col gap-4 text-center">
              {subheadline}
            </Text>
            {cta}
          </div>
          <div className="overflow-hidden rounded-xl outline -outline-offset-1 outline-black/5 dark:outline-white/5">
            {photo}
          </div>
        </div>
        {footer}
      </Container>
    </section>
  )
}

import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'

export function TestimonialLargeQuote({
  quote,
  img,
  name,
  byline,
  className,
  ...props
}: {
  quote: ReactNode
  img: ReactNode
  name: ReactNode
  byline: ReactNode
} & ComponentProps<'section'>) {
  return (
    <section className={clsx('py-16', className)} {...props}>
      <Container>
        <figure className="text-mist-950 dark:text-white">
          <blockquote className="mx-auto flex max-w-240 flex-col gap-4 text-center font-display text-[2rem]/12 tracking-tight text-pretty *:first:before:content-['“'] *:last:after:content-['”'] sm:text-5xl/16">
            {quote}
          </blockquote>
          <figcaption className="mt-16 flex flex-col items-center">
            <div className="flex size-12 overflow-hidden rounded-full outline -outline-offset-1 outline-black/5 *:size-full *:object-cover dark:outline-white/5">
              {img}
            </div>
            <p className="mt-4 text-center text-sm/6 font-semibold">{name}</p>
            <p className="text-center text-sm/6 text-mist-700 dark:text-mist-400">{byline}</p>
          </figcaption>
        </figure>
      </Container>
    </section>
  )
}

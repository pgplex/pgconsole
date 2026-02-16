import { ButtonLink, PlainButtonLink } from '@/components/elements/button'
import { ChevronIcon } from '@/components/icons/chevron-icon'
import { CallToActionSimpleCentered } from '@/components/sections/call-to-action-simple-centered'
import { LINKS } from '@/lib/links'
import type { ReactNode } from 'react'

export function CTA({
  headline = 'Deploy in 1 minute',
  subheadline = (
    <p>
      One command to install. Connect your PostgreSQL databases and start querying right away.
    </p>
  ),
}: {
  headline?: ReactNode
  subheadline?: ReactNode
} = {}) {
  return (
    <CallToActionSimpleCentered
      id="call-to-action"
      headline={headline}
      subheadline={subheadline}
      cta={
        <div className="flex items-center gap-4">
          <ButtonLink href={LINKS.quickstart} target="_blank" size="lg">
            Get started
          </ButtonLink>

          <PlainButtonLink href={LINKS.demo} target="_blank" size="lg">
            Live demo <ChevronIcon />
          </PlainButtonLink>
        </div>
      }
    />
  )
}

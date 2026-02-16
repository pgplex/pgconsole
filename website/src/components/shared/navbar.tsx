import { ButtonLink, PlainButtonLink } from '@/components/elements/button'
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLogoActionsAndCenteredLinks,
} from '@/components/sections/navbar-with-logo-actions-and-centered-links'
import { LINKS } from '@/lib/links'

export function Navbar() {
  return (
    <NavbarWithLogoActionsAndCenteredLinks
      id="navbar"
      logo={
        <NavbarLogo href="/">
          <img src="/logo-light.svg" alt="pgconsole" className="h-7 w-auto dark:hidden" />
          <img src="/logo-dark.svg" alt="pgconsole" className="h-7 w-auto not-dark:hidden" />
        </NavbarLogo>
      }
      links={
        <>
          <NavbarLink href="/pricing">Pricing</NavbarLink>
          <NavbarLink href={LINKS.docs} target="_blank">Docs</NavbarLink>
          <NavbarLink href={LINKS.demo} target="_blank" className="sm:hidden">
            Live demo
          </NavbarLink>
        </>
      }
      actions={
        <>
          <PlainButtonLink href={LINKS.demo} target="_blank" className="max-sm:hidden">
            Live demo
          </PlainButtonLink>
          <ButtonLink href={LINKS.quickstart} target="_blank">Get started</ButtonLink>
        </>
      }
    />
  )
}

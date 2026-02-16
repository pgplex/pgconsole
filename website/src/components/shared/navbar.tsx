import { ButtonLink } from '@/components/elements/button'
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
          <NavbarLink href={LINKS.demo} target="_blank">
            Live demo 👈
          </NavbarLink>
        </>
      }
      actions={
        <>
          <a
            href={LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="inline-flex rounded-full p-1.5 text-mist-950 hover:bg-mist-950/10 dark:text-white dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="size-5">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
          <ButtonLink href={LINKS.quickstart} target="_blank">Get started</ButtonLink>
        </>
      }
    />
  )
}

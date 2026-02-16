import { Container } from '@/components/elements/container'
import { GitHubIcon } from '@/components/icons/social/github-icon'

export function Footer() {
  return (
    <footer className="mt-4 py-6">
      <Container className="flex items-center justify-between text-sm text-mist-600 dark:text-mist-500">
        <span>{`© ${new Date().getFullYear()} pgconsole`}</span>
        <a
          href="https://github.com/pgplex/pgconsole"
          target="_blank"
          aria-label="GitHub"
          className="text-mist-950 *:size-5 dark:text-white"
        >
          <GitHubIcon />
        </a>
      </Container>
    </footer>
  )
}

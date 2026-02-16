import { InstallCommand } from '@/components/elements/install-command'
import { Link } from '@/components/elements/link'
import { Main } from '@/components/elements/main'
import { Screenshot } from '@/components/elements/screenshot'
import { ChevronIcon } from '@/components/icons/chevron-icon'
import {
  Feature,
  FeaturesStackedAlternatingWithDemos,
} from '@/components/sections/features-stacked-alternating-with-demos'
import { HeroCenteredWithDemo } from '@/components/sections/hero-centered-with-demo'
import { Section } from '@/components/elements/section'
import { CTA } from '@/components/shared/cta'
import { Footer } from '@/components/shared/footer'
import { Navbar } from '@/components/shared/navbar'

export default function Page() {
  return (
    <>
      <Navbar />

      <Main>
        {/* Hero */}
        <HeroCenteredWithDemo
          id="hero"
          headline="Minimal Postgres editor for speed and collaboration"
          subheadline={
            <p>
              A self-hosted PostgreSQL editor with built-in access control, audit logging, and AI assistance
              — all from a single binary, and a TOML.
            </p>
          }
          cta={
            <div className="flex flex-col items-center gap-3">
              <InstallCommand className="min-w-xs" snippet="npx @pgplex/pgconsole@latest" />
              <span className="text-sm text-mist-500 dark:text-mist-400">or</span>
              <InstallCommand className="min-w-xs" snippet="docker run -p 9876:9876 pgplex/pgconsole" />
            </div>
          }
          demo={
            <img
              src="/sql-editor-overview.webp"
              alt="pgconsole SQL editor"
              className="rounded-lg ring-1 ring-black/10"
              width={2880}
              height={1800}
            />
          }
        />

        {/* Features */}
        <FeaturesStackedAlternatingWithDemos
          id="features"
          className="[&>div>div:first-child]:mx-auto [&>div>div:first-child]:text-center"
          headline="Single binary. Single config. No database required."
          subheadline={
            <p>
              Connect your team to PostgreSQL with access control and audit logging built in.
            </p>
          }
          features={
            <>
              <Feature
                headline="GitOps Native"
                subheadline={
                  <p>
                    Everything lives in pgconsole.toml — connections, users, groups, access rules. No database, no
                    migrations. Review access changes in PRs the same way you review code.
                  </p>
                }
                demo={
                  <Screenshot wallpaper="blue" placement="bottom-right">
                    <img src="/pgconsole-toml.webp" alt="pgconsole.toml configuration" width={960} height={1040} />
                  </Screenshot>
                }
              />
              <Feature
                headline="AI Assistant"
                subheadline={
                  <p>
                    Generate SQL from natural language, explain queries, fix errors, and assess change risk. Bring your
                    own AI provider — your data never leaves your infrastructure.
                  </p>
                }
                cta={
                  <Link href="https://docs.pgconsole.com/features/ai-assistant" target="_blank">
                    Learn more <ChevronIcon />
                  </Link>
                }
                demo={
                  <Screenshot wallpaper="brown" placement="top-right">
                    <img src="/ai-text-to-sql.webp" alt="AI text to SQL" width={450} height={500} />
                  </Screenshot>
                }
              />
              <Feature
                headline="Full PostgreSQL Intellisense"
                subheadline={
                  <p>
                    Built on a full PostgreSQL parser — not regex. Autocomplete, syntax highlighting, and error detection
                    that works on CTEs, subqueries, and window functions.
                  </p>
                }
                cta={
                  <Link href="https://docs.pgconsole.com/features/sql-editor" target="_blank">
                    Learn more <ChevronIcon />
                  </Link>
                }
                demo={
                  <Screenshot wallpaper="purple" placement="top-left">
                    <img src="/sql-editor-autocomplete.webp" alt="SQL autocomplete" width={1600} height={1200} />
                  </Screenshot>
                }
              />
              <Feature
                headline="Database Access Control"
                subheadline={
                  <p>
                    Server-side connections keep credentials off individual machines. Fine-grained IAM controls who can
                    read, write, or administer each connection. Every query is logged.
                  </p>
                }
                cta={
                  <Link href="https://docs.pgconsole.com/features/database-access-control" target="_blank">
                    Learn more <ChevronIcon />
                  </Link>
                }
                demo={
                  <Screenshot wallpaper="green" placement="bottom-left">
                    <img src="/iam-permission-badge.webp" alt="Access control permissions" width={1216} height={514} />
                  </Screenshot>
                }
              />
            </>
          }
        />

        {/* Use Cases */}
        <Section
          id="use-cases"
          className="[&>div>div:first-child]:mx-auto [&>div>div:first-child]:text-center"
          headline="Use cases"
          subheadline={<p>From solo developers to enterprise teams shipping PostgreSQL-powered products.</p>}
        >
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-xl bg-mist-950/2.5 p-6 sm:p-8 dark:bg-white/5">
              <div className="flex flex-col gap-6 text-xl/8 sm:text-2xl/9">
                <h3 className="text-mist-950 dark:text-white">Team</h3>
                <p className="text-pretty text-mist-500">
                  Credentials on the server, permissions per user, every query logged. Manage access control in Git.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl bg-mist-950/2.5 p-6 sm:p-8 dark:bg-white/5">
              <div className="flex flex-col gap-6 text-xl/8 sm:text-2xl/9">
                <h3 className="text-mist-950 dark:text-white">Individual Developer</h3>
                <p className="text-pretty text-mist-500">
                  A modern alternative to pgAdmin, DBeaver, or psql. No account, no Java, no Electron — starts in seconds.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl bg-mist-950/2.5 p-6 sm:p-8 dark:bg-white/5">
              <div className="flex flex-col gap-6 text-xl/8 sm:text-2xl/9">
                <h3 className="text-mist-950 dark:text-white">Bundle with Your Product</h3>
                <p className="text-pretty text-mist-500">
                  Add a database UI to any PostgreSQL-powered product. Configure once, ready for your customers.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Call To Action */}
        <CTA />
      </Main>

      <Footer />
    </>
  )
}

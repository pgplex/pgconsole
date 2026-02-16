import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'
import { Container } from '../elements/container'

export function FooterCategory({ title, children, ...props }: { title: ReactNode } & ComponentProps<'div'>) {
  return (
    <div {...props}>
      <h3>{title}</h3>
      <ul role="list" className="mt-2 flex flex-col gap-2">
        {children}
      </ul>
    </div>
  )
}

export function FooterLink({ href, className, ...props }: { href: string } & Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <li className={clsx('text-mist-700 dark:text-mist-400', className)}>
      <a href={href} {...props} />
    </li>
  )
}

export function FooterWithLinkCategories({
  links,
  fineprint,
  className,
  ...props
}: {
  links: ReactNode
  fineprint: ReactNode
} & ComponentProps<'footer'>) {
  return (
    <footer className={clsx('pt-16', className)} {...props}>
      <div className="bg-mist-950/2.5 py-16 text-mist-950 dark:bg-white/5 dark:text-white">
        <Container className="flex flex-col gap-16">
          <nav className="grid grid-cols-2 gap-6 text-sm/7 sm:has-[>:last-child:nth-child(3)]:grid-cols-3 sm:has-[>:nth-child(5)]:grid-cols-3 md:has-[>:last-child:nth-child(4)]:grid-cols-4 lg:has-[>:nth-child(5)]:grid-cols-5">
            {links}
          </nav>
          <div className="text-sm/7 text-mist-600 dark:text-mist-500">{fineprint}</div>
        </Container>
      </div>
    </footer>
  )
}

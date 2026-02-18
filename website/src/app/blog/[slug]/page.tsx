import { notFound } from 'next/navigation'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import toml from 'highlight.js/lib/languages/ini'
import bash from 'highlight.js/lib/languages/bash'
import MarkdownIt from 'markdown-it'
import 'highlight.js/styles/github-dark-dimmed.css'

hljs.registerLanguage('sql', sql)
hljs.registerLanguage('toml', toml)
hljs.registerLanguage('bash', bash)
import { Container } from '@/components/elements/container'
import { Eyebrow } from '@/components/elements/eyebrow'
import { Main } from '@/components/elements/main'
import { Text } from '@/components/elements/text'
import { Footer } from '@/components/shared/footer'
import { Navbar } from '@/components/shared/navbar'
import { formatDate, getPost, getPosts } from '@/lib/blog'

interface TocEntry {
  id: string
  text: string
  level: number
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  for (const match of markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const text = match[2]
    entries.push({ id: slugify(text), text, level: match[1].length })
  }
  return entries
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang }).value
    }
    return ''
  },
})

// Add id attributes to h2/h3 for TOC anchor links
md.renderer.rules.heading_open = (tokens, idx) => {
  const token = tokens[idx]
  const tag = token.tag
  if (tag === 'h2' || tag === 'h3') {
    const content = tokens[idx + 1]?.children?.map((t) => t.content).join('') ?? ''
    const id = slugify(content)
    return `<${tag} id="${id}">`
  }
  return `<${tag}>`
}

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const toc = extractToc(post.content)
  const html = md.render(post.content)

  return (
    <>
      <Navbar />

      <Main>
        <section className="py-16">
          <Container>
            <div className="flex max-w-2xl flex-col gap-4">
              <Eyebrow>
                <a href="/blog" className="hover:underline">
                  Blog
                </a>
              </Eyebrow>
              <h1 className="font-display text-[2rem]/10 tracking-tight text-pretty text-mist-950 sm:text-5xl/14 dark:text-white">
                {post.title}
              </h1>
              <Text>{formatDate(post.date)}</Text>
            </div>

            <div className="relative mt-8 flex gap-16">
              <div
                className="prose prose-mist dark:prose-invert max-w-2xl min-w-0"
                dangerouslySetInnerHTML={{ __html: html }}
              />

              {toc.length > 0 && (
                <nav className="hidden lg:block">
                  <div className="sticky top-8 w-56">
                    <p className="text-sm/7 font-semibold text-mist-950 dark:text-white">On this page</p>
                    <ul className="mt-2 flex flex-col gap-1.5 border-l border-mist-950/10 dark:border-white/10">
                      {toc.map((entry) => (
                        <li key={entry.id}>
                          <a
                            href={`#${entry.id}`}
                            className={`block border-l -ml-px py-0.5 text-sm/6 text-mist-600 hover:border-mist-950 hover:text-mist-950 dark:text-mist-400 dark:hover:border-white dark:hover:text-white ${entry.level === 3 ? 'border-transparent pl-6' : 'border-transparent pl-4'}`}
                          >
                            {entry.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </nav>
              )}
            </div>
          </Container>
        </section>
      </Main>

      <Footer />
    </>
  )
}

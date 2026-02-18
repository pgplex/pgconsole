import { notFound } from 'next/navigation'
import Markdown from 'react-markdown'
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

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const toc = extractToc(post.content)

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
              <div className="prose prose-mist dark:prose-invert max-w-2xl min-w-0">
                <Markdown
                  components={{
                    h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
                    h3: ({ children }) => <h3 id={slugify(String(children))}>{children}</h3>,
                  }}
                >
                  {post.content}
                </Markdown>
              </div>

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

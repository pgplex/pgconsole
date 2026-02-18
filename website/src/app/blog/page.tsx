import { Container } from '@/components/elements/container'
import { Eyebrow } from '@/components/elements/eyebrow'
import { Main } from '@/components/elements/main'
import { Subheading } from '@/components/elements/subheading'
import { Text } from '@/components/elements/text'
import { Footer } from '@/components/shared/footer'
import { Navbar } from '@/components/shared/navbar'
import { formatDate, getPosts } from '@/lib/blog'

export default function BlogPage() {
  const posts = getPosts()
  const featured = posts.find((p) => p.featured)
  const rest = posts.filter((p) => p !== featured)

  return (
    <>
      <Navbar />

      <Main>
        <section className="py-16">
          <Container className="flex flex-col gap-10 sm:gap-16">
            <div className="flex flex-col gap-2">
              <Eyebrow>Blog</Eyebrow>
              <Subheading>Latest posts</Subheading>
            </div>

            {featured && (
              <a href={`/blog/${featured.slug}`} className="group block">
                <div className="flex max-w-2xl flex-col gap-3 rounded-xl bg-mist-950/2.5 p-6 sm:p-8 dark:bg-white/5">
                  <h3 className="font-display text-[2rem]/10 tracking-tight text-mist-950 group-hover:underline sm:text-5xl/14 dark:text-white">
                    {featured.title}
                  </h3>
                  <Text>{featured.description}</Text>
                  <Text className="text-sm/7">{formatDate(featured.date)}</Text>
                </div>
              </a>
            )}

            {rest.length > 0 && (
              <div className="flex flex-col divide-y divide-mist-950/10 dark:divide-white/10">
                {rest.map((post) => (
                  <a
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex items-baseline justify-between gap-4 py-4"
                  >
                    <span className="text-base/7 font-medium text-mist-950 group-hover:underline dark:text-white">
                      {post.title}
                    </span>
                    <span className="shrink-0 text-sm/7 text-mist-700 dark:text-mist-400">
                      {formatDate(post.date)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </Container>
        </section>
      </Main>

      <Footer />
    </>
  )
}

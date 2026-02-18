import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  featured?: boolean
}

const blogDir = path.join(process.cwd(), 'content/blog')

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function getPost(slug: string): (BlogPost & { content: string }) | undefined {
  const file = path.join(blogDir, `${slug}.md`)
  if (!fs.existsSync(file)) return undefined
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'))
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    featured: data.featured,
    content,
  }
}

export function getPosts(): BlogPost[] {
  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'))
  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const { data } = matter(fs.readFileSync(path.join(blogDir, file), 'utf-8'))
    return {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      featured: data.featured,
    } as BlogPost
  })
  return posts.sort((a, b) => (a.date > b.date ? -1 : 1))
}

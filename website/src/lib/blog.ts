export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  featured?: boolean
}

export const posts: BlogPost[] = [
  {
    slug: 'pgconsole-1-0',
    title: 'Introducing pgconsole 1.0',
    description:
      'A self-hosted PostgreSQL editor with built-in access control, audit logging, and AI assistance — all from a single binary, and a TOML.',
    date: '2025-06-01',
    featured: true,
  },
  {
    slug: 'pgconsole-1-1',
    title: 'pgconsole 1.1: AI SQL assistant and more',
    description:
      'Generate, explain, fix, and rewrite SQL with AI providers you control. Plus new permission levels and schema caching.',
    date: '2025-08-15',
  },
]

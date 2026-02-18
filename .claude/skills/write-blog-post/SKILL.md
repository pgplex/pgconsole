---
name: write-blog-post
description: Use when writing a blog post for the pgconsole website. Covers file location, frontmatter, structure, length, and writing style conventions.
---

# Write Blog Post

## File Setup

- Location: `website/content/blog/{slug}.md`
- Slug becomes the URL: `/blog/{slug}`
- Rendering: markdown-it with highlight.js (sql, toml, bash)

Frontmatter:

```yaml
---
title: "Postgres 19 Feature Preview: Feature Name Here"
description: "One sentence summary of the post."
date: "YYYY-MM-DD"
---
```

## Structure

```
[Intro: 2-3 sentences. State the problem this feature solves.]

[One-liner naming the commit/release that fixes it.]

## Section Heading

[Explain what changed. Use one concrete before/after code example.]

## Section Heading (if multiple features)

[Same pattern. If features share a theme, merge smaller ones into a parent section.]

## Closing Thoughts

[2-3 sentences. Tie the changes back to the problem stated in the intro.]

## References

- [Commit link](url)
- [Mailing list thread](url)
```

## Writing Style

- **Target ~500 words.** If over 700, cut. Each section should earn its length.
- **Pragmatic titles.** Describe what changed, not a marketing pitch. "pg_stat_statements Gets Better Normalization and Plan Counters" not "pg_stat_statements Finally Scales."
- **Lead with the pain.** Intro should make the reader feel the problem before presenting the fix.
- **One code example per concept.** Don't show before AND after if one block with comments conveys both.
- **Merge small features.** If two changes solve the same problem, put them in one section rather than giving each its own heading.
- **Concrete over abstract.** Name specific tools (JDBC, pgx, psycopg), specific ORMs (ActiveRecord, Django), specific scenarios (batch loading, ETL).
- **Link commits and mailing list threads.** Every feature should reference its commit hash and any pgsql-hackers discussion.
- **No filler.** No "In this post we'll explore..." or "Let's dive into...". Start with the substance.

## Workflow

### Step 1: Find Topic Candidates

Start from the PostgreSQL commitfest history at https://commitfest.postgresql.org/commitfest_history/. Browse committed patches for the target PG version. Cross-reference with the pgpedia version page (https://pgpedia.info/postgresql-versions/)

Look for features that are:
- **High impact** — affects many users (SQL syntax, monitoring, replication)
- **Has a real-world pain point** — outage reports, known limitations, common complaints
- **Demonstrable** — can show concrete before/after with SQL examples

Present 3-5 candidates to the user with a one-line summary each. Wait for confirmation before writing.

### Step 2: Deep Research

For the confirmed topic, gather:

1. Commit hash and commit message (from git.postgresql.org)
2. pgsql-hackers mailing list thread (the "why" behind the change)
3. Real-world incident or pain point that motivates the feature (blog posts, outage reports, HN threads)
4. What existed before and why it was insufficient

### Step 3: Write the Post

Follow the Structure and Writing Style sections above. After writing, verify the website builds with `pnpm build` from the `website/` directory.

## Reference Posts

These published posts set the standard for tone and structure:

- `website/content/blog/postgres-19-feature-preview-pg-stat-statements.md`

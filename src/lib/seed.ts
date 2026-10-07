/**
 * One-time seeding of the newsroom: categories, desk bylines and clearly
 * flagged demonstration content (is_sample = 1). Idempotent — safe on every
 * boot. `npm run db:reset` (scripts/reset-db.mjs) wipes and reseeds.
 */

import { SEED_VERSION, seedArticles, seedAuthors, seedCategories } from '../content/seed-data'
import { getDb } from './db'

export function ensureSeeded() {
  const db = getDb()
  const row = db.prepare("SELECT value FROM meta WHERE key = 'seed_version'").get() as
    | { value: string }
    | undefined
  if (row && Number(row.value) >= SEED_VERSION) return

  const seed = db.transaction(() => {
    const catCount = (db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n
    if (catCount === 0) {
      const stmt = db.prepare(
        'INSERT INTO categories (slug, name, description, position, is_active) VALUES (?,?,?,?,1)',
      )
      for (const c of seedCategories) stmt.run(c.slug, c.name, c.description, c.position)
    }

    const authorCount = (db.prepare('SELECT COUNT(*) AS n FROM authors').get() as { n: number }).n
    if (authorCount === 0) {
      const stmt = db.prepare(
        'INSERT INTO authors (slug, name, role_title, bio, is_active) VALUES (?,?,?,?,1)',
      )
      for (const a of seedAuthors) stmt.run(a.slug, a.name, a.role_title, a.bio)
    }

    const articleCount = (db.prepare('SELECT COUNT(*) AS n FROM articles').get() as { n: number }).n
    if (articleCount === 0) {
      const catIds = new Map(
        (db.prepare('SELECT id, slug FROM categories').all() as { id: number; slug: string }[]).map(
          (c) => [c.slug, c.id],
        ),
      )
      const authorIds = new Map(
        (db.prepare('SELECT id, slug FROM authors').all() as { id: number; slug: string }[]).map(
          (a) => [a.slug, a.id],
        ),
      )
      const stmt = db.prepare(
        `INSERT INTO articles
          (slug, kind, title, deck, body, category_id, author_id, status, featured, breaking,
           breaking_at, trending, image, image_alt, image_caption, image_credit, video_url,
           video_duration, programme, tags, published_at, updated_at, created_at, is_sample)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      )
      const taken = new Set<string>()
      for (const raw of seedArticles) {
        const a = raw as any
        let slug: string = a.slug
        let n = 2
        while (taken.has(slug)) slug = `${a.slug}-${n++}`
        taken.add(slug)
        const published = a.status === 'published'
        stmt.run(
          slug,
          a.kind,
          a.title,
          a.deck ?? '',
          a.body,
          (catIds.get(a.category) ?? catIds.get('ogun')) as number,
          (authorIds.get(a.author) ?? authorIds.get('ogctv-newsroom')) as number,
          a.status,
          a.featured ? 1 : 0,
          a.breaking ? 1 : 0,
          a.breaking && published ? a.publishedAt : null,
          a.trending ? 1 : 0,
          a.image ?? null,
          a.imageAlt ?? '',
          a.imageCaption ?? '',
          a.imageCredit ?? '',
          a.videoUrl ?? null,
          a.videoDuration ?? '',
          a.programme ?? '',
          (a.tags ?? []).join(', '),
          published ? a.publishedAt : null,
          a.publishedAt,
          a.publishedAt,
        )
      }
      // Build the search index for seeded content.
      const fts = db.prepare('DELETE FROM article_fts')
      fts.run()
      const sync = db.prepare(
        `INSERT INTO article_fts (article_id, title, deck, body, tags, author_name, category_name)
         SELECT a.id, a.title, a.deck, a.body, a.tags, au.name, c.name
         FROM articles a JOIN authors au ON au.id = a.author_id JOIN categories c ON c.id = a.category_id`,
      )
      sync.run()
    }

    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_version', ?)").run(
      String(SEED_VERSION),
    )
  })
  seed()
}

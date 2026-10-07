/**
 * Content access layer. Every page reads the newsroom through these
 * functions so the storage engine can change without touching pages.
 */
import {
  type Article,
  type ArticleStatus,
  type Author,
  type Category,
  type FullArticle,
  getDb,
  syncFts,
} from './db'
import { escapeHtml, slugify, uniqueSlug } from './utils'

const ARTICLE_SELECT = `
  SELECT a.*, c.slug AS category_slug, c.name AS category_name,
         au.slug AS author_slug, au.name AS author_name, au.role_title AS author_role
  FROM articles a
  JOIN categories c ON c.id = a.category_id
  JOIN authors au ON au.id = a.author_id
`

type Row = Record<string, unknown>

function all(stmt: string, ...args: unknown[]): FullArticle[] {
  return getDb()
    .prepare(stmt)
    .all(...args) as unknown as FullArticle[]
}

function get(stmt: string, ...args: unknown[]): FullArticle | undefined {
  return getDb()
    .prepare(stmt)
    .get(...args) as unknown as FullArticle | undefined
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export function getPublishedArticle(slug: string): FullArticle | undefined {
  return get(`${ARTICLE_SELECT} WHERE a.slug = ? AND a.status = 'published'`, slug)
}

export function getArticleById(id: number): FullArticle | undefined {
  return get(`${ARTICLE_SELECT} WHERE a.id = ?`, id)
}

export function getBreaking(limit = 5): FullArticle[] {
  return all(
    `${ARTICLE_SELECT}
     WHERE a.breaking = 1 AND a.status = 'published'
     ORDER BY COALESCE(a.breaking_at, a.published_at) DESC
     LIMIT ?`,
    limit,
  )
}

export interface ListOptions {
  kind?: 'story' | 'video' | 'all'
  categorySlug?: string
  authorSlug?: string
  programme?: string
  excludeIds?: number[]
  hasImage?: boolean
  page?: number
  perPage?: number
}

export interface ListResult {
  items: FullArticle[]
  total: number
  page: number
  pages: number
  perPage: number
}

export function listPublished(opts: ListOptions = {}): ListResult {
  const db = getDb()
  const perPage = Math.min(Math.max(opts.perPage ?? 12, 1), 60)
  const page = Math.max(opts.page ?? 1, 1)
  const where: string[] = ["a.status = 'published'"]
  const args: unknown[] = []

  if (opts.kind && opts.kind !== 'all') {
    where.push('a.kind = ?')
    args.push(opts.kind)
  }
  if (opts.categorySlug) {
    where.push('c.slug = ?')
    args.push(opts.categorySlug)
  }
  if (opts.authorSlug) {
    where.push('au.slug = ?')
    args.push(opts.authorSlug)
  }
  if (opts.programme) {
    where.push('a.programme = ?')
    args.push(opts.programme)
  }
  if (opts.hasImage) {
    where.push("a.image IS NOT NULL AND a.image != ''")
  }
  if (opts.excludeIds?.length) {
    where.push(`a.id NOT IN (${opts.excludeIds.map(() => '?').join(',')})`)
    args.push(...opts.excludeIds)
  }

  const whereSql = where.join(' AND ')
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM articles a
         JOIN categories c ON c.id = a.category_id
         JOIN authors au ON au.id = a.author_id
         WHERE ${whereSql}`,
      )
      .get(...args) as { n: number }
  ).n

  const items = all(
    `${ARTICLE_SELECT} WHERE ${whereSql}
     ORDER BY a.published_at DESC
     LIMIT ? OFFSET ?`,
    ...args,
    perPage,
    (page - 1) * perPage,
  )

  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)), perPage }
}

/** Homepage lead: newest featured story, else newest story with an image. */
export function getLeadStory(): FullArticle | undefined {
  const featured = get(
    `${ARTICLE_SELECT}
     WHERE a.status = 'published' AND a.kind = 'story' AND a.featured = 1
       AND a.image IS NOT NULL AND a.image != ''
     ORDER BY a.published_at DESC LIMIT 1`,
  )
  return (
    featured ??
    get(
      `${ARTICLE_SELECT}
       WHERE a.status = 'published' AND a.kind = 'story'
         AND a.image IS NOT NULL AND a.image != ''
       ORDER BY a.published_at DESC LIMIT 1`,
    ) ??
    get(
      `${ARTICLE_SELECT}
       WHERE a.status = 'published' AND a.kind = 'story'
       ORDER BY a.published_at DESC LIMIT 1`,
    )
  )
}

export function getSecondaryStories(excludeIds: number[], limit = 2): FullArticle[] {
  const excl = excludeIds.length ? `AND a.id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
  return all(
    `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.kind = 'story' ${excl}
     ORDER BY a.featured DESC, a.published_at DESC
     LIMIT ?`,
    ...excludeIds,
    limit,
  )
}

export function getTrending(limit = 5, excludeIds: number[] = []): FullArticle[] {
  const excl = excludeIds.length ? `AND a.id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
  const trending = all(
    `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.trending = 1 ${excl}
     ORDER BY a.published_at DESC LIMIT ?`,
    ...excludeIds,
    limit,
  )
  if (trending.length >= limit) return trending
  const fill = all(
    `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.trending = 0 ${excl}
     ORDER BY a.published_at DESC LIMIT ?`,
    ...excludeIds,
    limit,
  )
  const seen = new Set(trending.map((t) => t.id))
  return [...trending, ...fill.filter((f) => !seen.has(f.id))].slice(0, limit)
}

export interface CategoryBand {
  category: Category
  top: FullArticle | undefined
  list: FullArticle[]
}

export function getCategoryBand(
  slug: string,
  listCount = 3,
  excludeIds: number[] = [],
): CategoryBand | null {
  const category = getCategoryBySlug(slug)
  if (!category) return null
  const excl = excludeIds.length ? `AND a.id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
  const items = all(
    `${ARTICLE_SELECT} WHERE a.status = 'published' AND c.slug = ? ${excl}
     ORDER BY a.published_at DESC LIMIT ?`,
    slug,
    ...excludeIds,
    listCount + 1,
  )
  const [top, ...rest] = items
  return { category, top, list: rest.slice(0, listCount) }
}

export function getRelatedArticles(article: FullArticle, limit = 3): FullArticle[] {
  return all(
    `${ARTICLE_SELECT}
     WHERE a.status = 'published' AND a.kind = 'story' AND a.category_id = ? AND a.id != ?
     ORDER BY a.published_at DESC LIMIT ?`,
    article.category_id,
    article.id,
    limit,
  )
}

export function getMoreFromCategory(
  article: FullArticle,
  limit = 4,
  excludeIds: number[] = [],
): FullArticle[] {
  const excl = excludeIds.length ? `AND a.id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
  return all(
    `${ARTICLE_SELECT}
     WHERE a.status = 'published' AND a.category_id = ? AND a.id != ? ${excl}
     ORDER BY a.published_at DESC LIMIT ?`,
    article.category_id,
    article.id,
    ...excludeIds,
    limit,
  )
}

export function getRelatedVideos(video: FullArticle, limit = 4): FullArticle[] {
  return all(
    `${ARTICLE_SELECT}
     WHERE a.status = 'published' AND a.kind = 'video' AND a.id != ?
     ORDER BY a.published_at DESC LIMIT ?`,
    video.id,
    limit,
  )
}

export function getFeaturedVideo(): FullArticle | undefined {
  return (
    get(
      `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.kind = 'video' AND a.featured = 1
       ORDER BY a.published_at DESC LIMIT 1`,
    ) ??
    get(
      `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.kind = 'video'
       ORDER BY a.published_at DESC LIMIT 1`,
    )
  )
}

export interface ProgrammeInfo {
  slug: string
  name: string
  description: string
  count: number
}

/** Known OGCTV programmes (video groupings) — editable in config. */
export const PROGRAMMES: Omit<ProgrammeInfo, 'count'>[] = [
  {
    slug: 'ogctv-reports',
    name: 'OGCTV Reports',
    description: 'Field reporting from across Ogun State.',
  },
  {
    slug: 'ogctv-interviews',
    name: 'OGCTV Interviews',
    description: 'Newsmakers and community voices, in conversation.',
  },
  {
    slug: 'gateway-this-week',
    name: 'Gateway This Week',
    description: 'The week in Ogun politics, business and society.',
  },
  {
    slug: 'news-clips',
    name: 'News Clips',
    description: 'Short news updates from the OGCTV desk.',
  },
  {
    slug: 'community-diaries',
    name: 'Community Diaries',
    description: 'People and places across Ogun communities.',
  },
  {
    slug: 'sports-desk',
    name: 'Sports Desk',
    description: 'Grassroots and professional sport in Ogun.',
  },
]

export function getProgrammeCounts(): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT programme, COUNT(*) AS n FROM articles
       WHERE status = 'published' AND kind = 'video' AND programme != ''
       GROUP BY programme`,
    )
    .all() as { programme: string; n: number }[]
  return new Map(rows.map((r) => [r.programme, r.n]))
}

// ---------------------------------------------------------------------------
// Categories & authors
// ---------------------------------------------------------------------------

export function getCategories(activeOnly = true): Category[] {
  return getDb()
    .prepare(
      `SELECT * FROM categories ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY position, name`,
    )
    .all() as unknown as Category[]
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as
    | Category
    | undefined
}

export function getAuthors(activeOnly = true): Author[] {
  return getDb()
    .prepare(`SELECT * FROM authors ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY name`)
    .all() as unknown as Author[]
}

export function getAuthorBySlug(slug: string): Author | undefined {
  return getDb().prepare('SELECT * FROM authors WHERE slug = ?').get(slug) as Author | undefined
}

// ---------------------------------------------------------------------------
// Search (FTS5 with LIKE fallback)
// ---------------------------------------------------------------------------

export interface SearchHit {
  article: FullArticle
  titleHtml: string
  snippetHtml: string
}

/** Turn a raw user query into a safe FTS5 prefix query: word one* AND word two* */
export function ftsQuery(q: string): string {
  const words = q
    .replace(/["*()^:]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[+\-!]+/, ''))
    .filter((w) => w.length > 0)
    .slice(0, 8)
  if (!words.length) return ''
  return words.map((w) => `"${w}"*`).join(' AND ')
}

export interface SearchResult extends ListResult {
  hits: SearchHit[]
  query: string
}

export function searchArticles(
  q: string,
  page = 1,
  perPage = 12,
  kind: 'story' | 'video' | 'all' = 'all',
): SearchResult {
  const db = getDb()
  const fts = ftsQuery(q.trim())
  const empty: SearchResult = {
    items: [],
    hits: [],
    total: 0,
    page,
    pages: 1,
    perPage,
    query: q,
  }
  if (!fts) return empty

  const kindSql = kind === 'all' ? '' : 'AND a.kind = ?'
  const kindArgs = kind === 'all' ? [] : [kind]

  let rows: (Row & { title_html: string; snippet_html: string })[] = []
  let total = 0
  try {
    total = (
      db
        .prepare(
          `SELECT COUNT(*) AS n
           FROM article_fts f
           JOIN articles a ON a.id = f.article_id
           WHERE article_fts MATCH ? AND a.status = 'published' ${kindSql}`,
        )
        .get(fts, ...kindArgs) as { n: number }
    ).n
    rows = db
      .prepare(
        `SELECT a.*, c.slug AS category_slug, c.name AS category_name,
                au.slug AS author_slug, au.name AS author_name, au.role_title AS author_role,
                highlight(article_fts, 1, '<mark>', '</mark>') AS title_html,
                snippet(article_fts, 2, '<mark>', '</mark>', '…', 24) AS snippet_html
         FROM article_fts f
         JOIN articles a ON a.id = f.article_id
         JOIN categories c ON c.id = a.category_id
         JOIN authors au ON au.id = a.author_id
         WHERE article_fts MATCH ? AND a.status = 'published' ${kindSql}
         ORDER BY rank, a.published_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(fts, ...kindArgs, perPage, (page - 1) * perPage) as unknown as typeof rows
  } catch {
    rows = []
    total = 0
  }

  // FTS gives nothing for very short/garbled queries → fall back to LIKE.
  if (total === 0) {
    const like = `%${q.trim().replace(/[%_]/g, '')}%`
    if (like.length > 3) {
      total = (
        db
          .prepare(
            `SELECT COUNT(*) AS n
             FROM articles a
             WHERE a.status = 'published' ${kindSql}
               AND (a.title LIKE ? OR a.deck LIKE ? OR a.tags LIKE ?)`,
          )
          .get(...kindArgs, like, like, like) as { n: number }
      ).n
      rows = db
        .prepare(
          `SELECT a.*, c.slug AS category_slug, c.name AS category_name,
                  au.slug AS author_slug, au.name AS author_name, au.role_title AS author_role,
                  a.title AS title_html, a.deck AS snippet_html
           FROM articles a
           JOIN categories c ON c.id = a.category_id
           JOIN authors au ON au.id = a.author_id
           WHERE a.status = 'published' ${kindSql}
             AND (a.title LIKE ? OR a.deck LIKE ? OR a.tags LIKE ?)
           ORDER BY a.published_at DESC
           LIMIT ? OFFSET ?`,
        )
        .all(...kindArgs, like, like, like, perPage, (page - 1) * perPage) as unknown as typeof rows
    }
  }
  return {
    items: rows as unknown as FullArticle[],
    hits: rows.map((r) => ({
      article: r as unknown as FullArticle,
      titleHtml: escapeHtml(String(r.title_html || ''))
        .replaceAll('&lt;mark&gt;', '<mark>')
        .replaceAll('&lt;/mark&gt;', '</mark>'),
      snippetHtml: escapeHtml(String(r.snippet_html || ''))
        .replaceAll('&lt;mark&gt;', '<mark>')
        .replaceAll('&lt;/mark&gt;', '</mark>'),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
    query: q,
  }
}

// ---------------------------------------------------------------------------
// Admin lists & writes
// ---------------------------------------------------------------------------

export interface AdminListOptions {
  status?: ArticleStatus | 'all'
  kind?: 'story' | 'video' | 'all'
  q?: string
}

export function listArticlesAdmin(opts: AdminListOptions = {}): FullArticle[] {
  const where: string[] = ['1=1']
  const args: unknown[] = []
  if (opts.status && opts.status !== 'all') {
    where.push('a.status = ?')
    args.push(opts.status)
  }
  if (opts.kind && opts.kind !== 'all') {
    where.push('a.kind = ?')
    args.push(opts.kind)
  }
  if (opts.q?.trim()) {
    where.push('(a.title LIKE ? OR a.slug LIKE ?)')
    const like = `%${opts.q.trim().replace(/[%_]/g, '')}%`
    args.push(like, like)
  }
  return all(
    `${ARTICLE_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY CASE a.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
              a.updated_at DESC`,
    ...args,
  )
}

export interface ArticleWriteInput {
  slug?: string
  kind: 'story' | 'video'
  title: string
  deck: string
  body: string
  category_id: number
  author_id: number
  status: ArticleStatus
  featured: boolean
  breaking: boolean
  trending: boolean
  image: string | null
  image_alt: string
  image_caption: string
  image_credit: string
  video_url: string | null
  video_duration: string
  programme: string
  tags: string
  is_sample?: boolean
  publishNow?: boolean
}

export function createArticle(input: ArticleWriteInput): number {
  const db = getDb()
  const now = new Date().toISOString()
  const taken = db.prepare('SELECT slug FROM articles').all() as { slug: string }[]
  const slug = uniqueSlug(
    slugify(input.slug || input.title),
    taken.map((t) => t.slug),
  )
  const publishedAt =
    input.status === 'published' ? (input.publishNow === false ? null : now) : null
  const info = db
    .prepare(
      `INSERT INTO articles
        (slug, kind, title, deck, body, category_id, author_id, status, featured, breaking,
         breaking_at, trending, image, image_alt, image_caption, image_credit, video_url,
         video_duration, programme, tags, published_at, updated_at, created_at, is_sample)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      slug,
      input.kind,
      input.title,
      input.deck,
      input.body,
      input.category_id,
      input.author_id,
      input.status,
      input.featured ? 1 : 0,
      input.breaking ? 1 : 0,
      input.breaking && input.status === 'published' ? now : null,
      input.trending ? 1 : 0,
      input.image,
      input.image_alt,
      input.image_caption,
      input.image_credit,
      input.video_url,
      input.video_duration,
      input.programme,
      input.tags,
      publishedAt,
      now,
      now,
      input.is_sample ? 1 : 0,
    )
  const id = Number(info.lastInsertRowid)
  syncFts(db, id)
  return id
}

export function updateArticle(id: number, input: ArticleWriteInput): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | undefined
  if (!existing) return false
  const now = new Date().toISOString()
  const taken = (
    db.prepare('SELECT slug FROM articles WHERE id != ?').all(id) as { slug: string }[]
  ).map((t) => t.slug)
  const slug = uniqueSlug(slugify(input.slug || input.title), taken)

  const publishedAt =
    input.status === 'published'
      ? existing.published_at || (input.publishNow === false ? null : now)
      : existing.status === 'published'
        ? existing.published_at // archiving keeps the original publish date
        : null

  const breakingAt =
    input.breaking && input.status === 'published'
      ? existing.breaking_at || now
      : input.breaking
        ? existing.breaking_at
        : null

  db.prepare(
    `UPDATE articles SET
       slug=?, kind=?, title=?, deck=?, body=?, category_id=?, author_id=?, status=?,
       featured=?, breaking=?, breaking_at=?, trending=?, image=?, image_alt=?, image_caption=?,
       image_credit=?, video_url=?, video_duration=?, programme=?, tags=?,
       published_at=?, updated_at=?, is_sample=?
     WHERE id = ?`,
  ).run(
    slug,
    input.kind,
    input.title,
    input.deck,
    input.body,
    input.category_id,
    input.author_id,
    input.status,
    input.featured ? 1 : 0,
    input.breaking ? 1 : 0,
    breakingAt,
    input.trending ? 1 : 0,
    input.image,
    input.image_alt,
    input.image_caption,
    input.image_credit,
    input.video_url,
    input.video_duration,
    input.programme,
    input.tags,
    publishedAt,
    now,
    input.is_sample ? 1 : 0,
    id,
  )
  syncFts(db, id)
  return true
}

export function deleteArticle(id: number): boolean {
  const db = getDb()
  db.prepare('DELETE FROM article_fts WHERE article_id = ?').run(id)
  const info = db.prepare('DELETE FROM articles WHERE id = ?').run(id)
  return info.changes > 0
}

export function upsertCategory(input: {
  id?: number
  slug: string
  name: string
  description: string
  position: number
  is_active: boolean
}): number {
  const db = getDb()
  const slug = slugify(input.slug || input.name)
  if (input.id) {
    db.prepare(
      'UPDATE categories SET slug=?, name=?, description=?, position=?, is_active=? WHERE id=?',
    ).run(slug, input.name, input.description, input.position, input.is_active ? 1 : 0, input.id)
    return input.id
  }
  const info = db
    .prepare(
      'INSERT INTO categories (slug, name, description, position, is_active) VALUES (?,?,?,?,?)',
    )
    .run(slug, input.name, input.description, input.position, input.is_active ? 1 : 0)
  return Number(info.lastInsertRowid)
}

export function deleteCategory(id: number): { ok: boolean; error?: string } {
  const db = getDb()
  const n = (
    db.prepare('SELECT COUNT(*) AS n FROM articles WHERE category_id = ?').get(id) as { n: number }
  ).n
  if (n > 0)
    return { ok: false, error: `${n} article(s) still use this category. Move them first.` }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  return { ok: true }
}

export function upsertAuthor(input: {
  id?: number
  slug: string
  name: string
  role_title: string
  bio: string
  is_active: boolean
}): number {
  const db = getDb()
  const slug = slugify(input.slug || input.name)
  if (input.id) {
    db.prepare(
      'UPDATE authors SET slug=?, name=?, role_title=?, bio=?, is_active=? WHERE id=?',
    ).run(slug, input.name, input.role_title, input.bio, input.is_active ? 1 : 0, input.id)
    return input.id
  }
  const info = db
    .prepare('INSERT INTO authors (slug, name, role_title, bio, is_active) VALUES (?,?,?,?,?)')
    .run(slug, input.name, input.role_title, input.bio, input.is_active ? 1 : 0)
  return Number(info.lastInsertRowid)
}

export interface NewsroomStats {
  published: number
  drafts: number
  archived: number
  breaking: number
  videos: number
  media: number
  categories: number
  authors: number
  sample: number
  latestPublishedAt: string | null
}

export function getNewsroomStats(): NewsroomStats {
  const db = getDb()
  const count = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n
  const latest = db
    .prepare(
      "SELECT published_at FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 1",
    )
    .get() as { published_at: string } | undefined
  return {
    published: count("SELECT COUNT(*) AS n FROM articles WHERE status='published'"),
    drafts: count("SELECT COUNT(*) AS n FROM articles WHERE status='draft'"),
    archived: count("SELECT COUNT(*) AS n FROM articles WHERE status='archived'"),
    breaking: count("SELECT COUNT(*) AS n FROM articles WHERE breaking=1 AND status='published'"),
    videos: count("SELECT COUNT(*) AS n FROM articles WHERE kind='video' AND status='published'"),
    media: count('SELECT COUNT(*) AS n FROM media'),
    categories: count('SELECT COUNT(*) AS n FROM categories'),
    authors: count('SELECT COUNT(*) AS n FROM authors'),
    sample: count('SELECT COUNT(*) AS n FROM articles WHERE is_sample=1'),
    latestPublishedAt: latest?.published_at ?? null,
  }
}

/** All published slugs for the sitemap. */
export function allPublishedForSitemap(): {
  slug: string
  kind: string
  updated_at: string
  published_at: string
}[] {
  return getDb()
    .prepare(
      "SELECT slug, kind, updated_at, published_at FROM articles WHERE status='published' AND is_sample=0 ORDER BY published_at DESC",
    )
    .all() as { slug: string; kind: string; updated_at: string; published_at: string }[]
}

/** Latest published stories (kind-agnostic) for the RSS feed. */
export function latestForFeed(limit = 20): FullArticle[] {
  return all(
    `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.is_sample = 0 ORDER BY a.published_at DESC LIMIT ?`,
    limit,
  )
}

/** Whether any published demonstration content still needs a public warning. */
export function hasPublishedSampleContent(): boolean {
  const row = getDb()
    .prepare("SELECT 1 AS found FROM articles WHERE is_sample = 1 AND status = 'published' LIMIT 1")
    .get() as { found: number } | undefined
  return Boolean(row)
}

/** Archive every sample story in one action (newsroom go-live step). */
export function archiveAllSample(): number {
  const db = getDb()
  const ids = db.prepare('SELECT id FROM articles WHERE is_sample = 1').all() as { id: number }[]
  const now = new Date().toISOString()
  const stmt = db.prepare(
    "UPDATE articles SET status='archived', breaking=0, trending=0, featured=0, updated_at=? WHERE id=?",
  )
  const run = db.transaction(() => {
    for (const { id } of ids) stmt.run(now, id)
  })
  run()
  return ids.length
}

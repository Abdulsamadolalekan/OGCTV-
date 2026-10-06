/**
 * Server-side validation for newsroom writes. The admin UI mirrors these
 * rules client-side, but the server is the source of truth.
 */
import { parseTags, slugify, videoEmbed } from './utils'

export type Errors = Record<string, string>

export interface ArticleInput {
  slug: string
  kind: 'story' | 'video'
  title: string
  deck: string
  body: string
  category_id: number
  author_id: number
  status: 'draft' | 'published' | 'archived'
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
  is_sample: boolean
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'on' || v === 1 || v === '1'
}

const DURATION_RE = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/

export function validateArticle(
  raw: Record<string, unknown>,
  ctx: { categoryIds: Set<number>; authorIds: Set<number> },
): { ok: true; value: ArticleInput } | { ok: false; errors: Errors } {
  const errors: Errors = {}

  const title = str(raw.title)
  if (title.length < 4) errors.title = 'Headline must be at least 4 characters.'
  if (title.length > 200) errors.title = 'Headline must be 200 characters or fewer.'

  const deck = str(raw.deck).slice(0, 400)

  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const status = ['draft', 'published', 'archived'].includes(str(raw.status))
    ? (str(raw.status) as ArticleInput['status'])
    : 'draft'
  const kind = str(raw.kind) === 'video' ? 'video' : 'story'

  if (status === 'published' && body.length < 40 && kind === 'story') {
    errors.body = 'Published stories need a body of at least 40 characters.'
  }

  const category_id = Number(raw.category_id)
  if (!category_id || !ctx.categoryIds.has(category_id)) errors.category_id = 'Choose a category.'

  const author_id = Number(raw.author_id)
  if (!author_id || !ctx.authorIds.has(author_id)) errors.author_id = 'Choose an author/byline.'

  const image = str(raw.image) || null
  if (image && !/^\/(seed-media|media)\/[\w.-]+$/.test(image)) {
    errors.image = 'Image must be selected from the media library.'
  }

  let video_url: string | null = null
  const rawVideo = str(raw.video_url)
  if (rawVideo) {
    try {
      const u = new URL(rawVideo.startsWith('http') ? rawVideo : `https://${rawVideo}`)
      if (u.protocol !== 'https:') throw new Error('https only')
      video_url = u.toString()
      if (kind === 'video' && !videoEmbed(video_url)) {
        // Allowed: a video entry can exist before its file/URL is connected —
        // the public page shows an honest "video coming soon" state.
        video_url = u.toString()
      }
    } catch {
      errors.video_url = 'Video URL must be a valid https:// link.'
    }
  }

  const video_duration = str(raw.video_duration)
  if (video_duration && !DURATION_RE.test(video_duration)) {
    errors.video_duration = 'Duration should look like 12:34 or 1:02:33.'
  }

  const tags = parseTags(typeof raw.tags === 'string' ? raw.tags : '').join(', ')

  const slug = slugify(str(raw.slug) || title)

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      slug,
      kind,
      title,
      deck,
      body,
      category_id,
      author_id,
      status,
      featured: bool(raw.featured),
      breaking: bool(raw.breaking),
      trending: bool(raw.trending),
      image,
      image_alt: str(raw.image_alt).slice(0, 300),
      image_caption: str(raw.image_caption).slice(0, 300),
      image_credit: str(raw.image_credit).slice(0, 200),
      video_url,
      video_duration,
      programme: str(raw.programme),
      tags,
      is_sample: bool(raw.is_sample),
    },
  } as { ok: true; value: ArticleInput } | { ok: false; errors: Errors }
}

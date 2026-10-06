/**
 * Shared utilities: slugs, timestamps (Africa/Lagos), reading time,
 * text helpers. No dependencies.
 */

const LAGOS_TZ = 'Africa/Lagos'

/** Generate a URL-safe slug from a title. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/g, '')
}

/** Ensure a slug is unique against a set of taken slugs (appends -2, -3, …). */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let slug = base || 'story'
  let n = 2
  while (used.has(slug)) {
    slug = `${base}-${n}`
    n++
  }
  return slug
}

const DATE_TIME = new Intl.DateTimeFormat('en-NG', {
  timeZone: LAGOS_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const DATE_ONLY = new Intl.DateTimeFormat('en-NG', {
  timeZone: LAGOS_TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const TIME_ONLY = new Intl.DateTimeFormat('en-NG', {
  timeZone: LAGOS_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatDateTime(iso: string | Date): string {
  return DATE_TIME.format(new Date(iso))
}

export function formatDate(iso: string | Date): string {
  return DATE_ONLY.format(new Date(iso))
}

export function formatTime(iso: string | Date): string {
  return TIME_ONLY.format(new Date(iso))
}

/** "8 minutes ago" style relative time, computed in Lagos time. */
export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now.getTime() - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(iso)
}

/** Rough reading time at ~220 words/minute (never shows "0 min"). */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

/** Plain-text excerpt from markdown body (used when no deck is set). */
export function excerptFromBody(body: string, max = 180): string {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max).trim()}…`
}

/** Escape a string for safe interpolation into HTML text nodes. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Turn a YouTube watch/share URL into an embed URL.
 * Returns null for anything that isn't clearly YouTube.
 */
export function youtubeEmbedUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{6,})/i,
    /youtu\.be\/([\w-]{6,})/i,
    /youtube\.com\/embed\/([\w-]{6,})/i,
    /youtube\.com\/shorts\/([\w-]{6,})/i,
    /youtube\.com\/live\/([\w-]{6,})/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`
  }
  return null
}

/** Any embeddable video URL → { src, provider }. Conservative allowlist. */
export function videoEmbed(url: string): { src: string; provider: string } | null {
  if (!url) return null
  const yt = youtubeEmbedUrl(url)
  if (yt) return { src: yt, provider: 'YouTube' }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i)
  if (vimeo) return { src: `https://player.vimeo.com/video/${vimeo[1]}`, provider: 'Vimeo' }
  return null
}

/** Parse a comma-separated tag string into clean unique tags. */
export function parseTags(input: string | string[] | null | undefined): string[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : input.split(',')
  const out: string[] = []
  for (const t of list) {
    const tag = t.trim().replace(/\s+/g, ' ')
    if (tag && !out.some((x) => x.toLowerCase() === tag.toLowerCase())) out.push(tag)
  }
  return out.slice(0, 12)
}

/** Absolute URL join that tolerates trailing slashes. */
export function absUrl(path: string, origin: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

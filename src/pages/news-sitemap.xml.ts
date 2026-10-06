import type { APIRoute } from 'astro'
import { SITE } from '../lib/config'
import { latestForFeed } from '../lib/queries'
import { escapeHtml } from '../lib/utils'

/**
 * Google News-compatible discovery feed. Inclusion here does not imply that
 * OGCTV is enrolled in or approved by Google News.
 */
export const GET: APIRoute = () => {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000
  const items = latestForFeed(1000).filter(
    (item) => item.published_at && new Date(item.published_at).getTime() >= cutoff,
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items
  .map((item) => {
    const path = item.kind === 'video' ? 'tv' : 'article'
    return `<url>
  <loc>${escapeHtml(`${SITE.url}/${path}/${item.slug}`)}</loc>
  <news:news>
    <news:publication><news:name>OGCTV</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${escapeHtml(item.published_at!)}</news:publication_date>
    <news:title>${escapeHtml(item.title)}</news:title>
  </news:news>
</url>`
  })
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

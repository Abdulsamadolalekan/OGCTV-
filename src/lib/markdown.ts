/**
 * Article body rendering: Markdown → HTML.
 *
 * Authors are authenticated newsroom staff, but we still sanitise output
 * (defence in depth): <script> blocks, inline on* handlers and javascript:
 * URLs are stripped; raw <iframe> embeds are only allowed for the video
 * hosts OGCTV uses (YouTube / Vimeo). Everything else renders through
 * a tight allowlist of Markdown features.
 */
import { Marked } from 'marked'
import { escapeHtml } from './utils'

const marked = new Marked({ gfm: true, breaks: false })

const VIDEO_HOSTS =
  /^(https:\/\/)?(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|vimeo\.com)\//i

marked.use({
  renderer: {
    // !![alt](src "caption") → <figure><img …><figcaption>caption</figcaption></figure>
    image(token) {
      const href = String(token.href || '')
      const alt = escapeHtml(String(token.text || ''))
      const caption = token.title ? escapeHtml(String(token.title)) : ''
      if (!/^(https:\/\/|\/)/i.test(href)) return ''
      const fig = caption ? `<figcaption>${caption}</figcaption>` : ''
      return `<figure class="article-inline-image"><img src="${escapeHtml(href)}" alt="${alt}" loading="lazy" decoding="async">${fig}</figure>`
    },
    link(token) {
      const href = String(token.href || '')
      const text = this.parser.parseInline(token.tokens ?? [])
      if (!/^(https?:\/\/|\/|#|mailto:)/i.test(href)) return text
      const external = /^https?:\/\//i.test(href)
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(href)}"${attrs}>${text}</a>`
    },
  },
})

/** Strip dangerous constructs from rendered article HTML. */
export function sanitizeArticleHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(script|style|form|input|button|select|textarea)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b([^>]*)>/gi, (_match, attrs: string) => {
      const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? ''
      return VIDEO_HOSTS.test(src)
        ? `<iframe src="${escapeHtml(src)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="Embedded video">`
        : ''
    })
}

/** Render trusted editor Markdown to safe article HTML. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string
  return sanitizeArticleHtml(html)
}

/** Split a rendered body into paragraphs/blocks for lead-paragraph handling. */
export function firstParagraph(html: string): string {
  const m = /<p[^>]*>[\s\S]*?<\/p>/i.exec(html)
  return m ? m[0] : ''
}

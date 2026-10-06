import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdown } from '../src/lib/markdown.ts'

test('article Markdown does not execute raw HTML', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)><script>alert(2)</script>')
  assert.doesNotMatch(html, /<script|<img/i)
  assert.match(html, /&lt;img/)
})

test('article Markdown keeps safe editorial links and images', () => {
  const html = renderMarkdown(
    '[Source](https://example.com)\n\n![A market](/media/market.jpg "Market caption")',
  )
  assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /<figure class="article-inline-image">/)
  assert.match(html, /Market caption/)
})

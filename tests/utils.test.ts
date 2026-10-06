import assert from 'node:assert/strict'
import test from 'node:test'
import { ftsQuery } from '../src/lib/queries.ts'
import { parseTags, readingTime, slugify, youtubeEmbedUrl } from '../src/lib/utils.ts'

test('slugify produces clean stable newsroom URLs', () => {
  assert.equal(slugify("Ogun’s Digital Voice: What's New?"), 'oguns-digital-voice-whats-new')
})

test('reading time is never zero', () => {
  assert.equal(readingTime(''), 1)
  assert.equal(readingTime(Array(441).fill('word').join(' ')), 2)
})

test('video embedding only recognises supported YouTube forms', () => {
  assert.equal(
    youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  )
  assert.equal(youtubeEmbedUrl('https://example.com/video'), null)
})

test('tags are trimmed and de-duplicated', () => {
  assert.deepEqual(parseTags('Ogun, Business, ogun, Local news'), [
    'Ogun',
    'Business',
    'Local news',
  ])
})

test('FTS input is quoted and limited instead of passed through raw', () => {
  assert.equal(ftsQuery('Ogun "market"*'), '"Ogun"* AND "market"*')
})

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { SITE } from '../src/lib/config.ts'

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const logoPath = at('../public/brand/ogctv-official-logo.jpg')

/**
 * The approved master artwork, exactly as supplied by the newsroom. Any change to
 * these values means the official logo was re-encoded, trimmed or replaced.
 */
const MASTER_SHA256 = '8b863b1fa9786451eafe51b2826c3a00d85ef7cbe994c14781485ca07d78720e'
const MASTER_BYTES = 621799
const MASTER_WIDTH = 1944
const MASTER_HEIGHT = 1920

/** Reads the JPEG start-of-frame header instead of trusting the file extension. */
function jpegDimensions(buffer: Buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  const frames = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])
  let i = 2
  while (i < buffer.length - 9) {
    if (buffer[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = buffer[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (frames.has(marker)) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
    }
    i += 2 + buffer.readUInt16BE(i + 2)
  }
  return null
}

test('the brand config points at the committed master asset', () => {
  assert.equal(SITE.logo, '/brand/ogctv-official-logo.jpg')
  assert.equal(SITE.logoWidth, MASTER_WIDTH)
  assert.equal(SITE.logoHeight, MASTER_HEIGHT)
  assert.ok(existsSync(logoPath), 'public/brand/ogctv-official-logo.jpg must be committed')
})

test('the official logo is stored byte-for-byte, never re-encoded or redrawn', () => {
  const buffer = readFileSync(logoPath)
  assert.equal(buffer.length, MASTER_BYTES, 'master file size changed')
  const digest = createHash('sha256').update(buffer).digest('hex')
  assert.equal(digest, MASTER_SHA256, 'master artwork bytes changed — restore the approved file')
  assert.deepEqual(jpegDimensions(buffer), { width: MASTER_WIDTH, height: MASTER_HEIGHT })
})

test('the placeholder artwork and typographic brand mark are fully retired', () => {
  assert.equal(existsSync(at('../public/favicon.svg')), false, 'placeholder favicon must be gone')
  const surfaces = [
    '../src/components/Header.astro',
    '../src/components/Footer.astro',
    '../src/layouts/AdminLayout.astro',
    '../src/pages/admin/login.astro',
    '../src/pages/admin/setup.astro',
    '../src/layouts/SiteLayout.astro',
  ]
  for (const file of surfaces) {
    const source = readFileSync(at(file), 'utf8')
    assert.match(source, /SITE\.logo/, `${file} must reference the master logo`)
    assert.doesNotMatch(source, /favicon\.svg/, `${file} must not reference the old placeholder`)
    assert.doesNotMatch(source, /class="brand-mark"/, `${file} must not keep the text logo`)
  }
})

test('social metadata falls back to the official logo when a story has no image', () => {
  const layout = readFileSync(at('../src/layouts/SiteLayout.astro'), 'utf8')
  assert.match(layout, /socialImg=img \?\? new URL\(SITE\.logo,\s*SITE\.url\)\.toString\(\)/)
  assert.match(layout, /property="og:image" content=\{socialImg\}/)
  assert.match(layout, /name="twitter:image" content=\{socialImg\}/)
  assert.match(layout, /rel="icon" href=\{SITE\.logo\}/)
  assert.match(layout, /rel="apple-touch-icon" href=\{SITE\.logo\}/)
})

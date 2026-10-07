import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { SITE } from '../src/lib/config.ts'

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const masterPath = at('../public/brand/ogctv-official-logo.jpg')
const markPath = at('../public/brand/ogctv-official-logo-trimmed.png')

/**
 * The approved master artwork, exactly as supplied by the newsroom. Any change to these values
 * means the official logo was re-encoded, trimmed or replaced.
 */
const MASTER_SHA256 = '8b863b1fa9786451eafe51b2826c3a00d85ef7cbe994c14781485ca07d78720e'
const MASTER_BYTES = 621799
const MASTER_WIDTH = 1944
const MASTER_HEIGHT = 1920
/** Rows 0-26 of the master are a solid black export band, not artwork. */
const BLACK_BAND_ROWS = 27
/** The rendered mark is an exact 1/3 scale of the master minus that band. */
const SCALE = 3
const MARK_WIDTH = MASTER_WIDTH / SCALE
const MARK_HEIGHT = (MASTER_HEIGHT - BLACK_BAND_ROWS) / SCALE

/** Reads a JPEG start-of-frame marker instead of trusting the file extension. */
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

/** Reads a PNG IHDR chunk. */
function pngDimensions(buffer: Buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== signature) return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** Maps a site path such as `/icons/favicon-32.png` onto the public directory. */
const readPublic = (sitePath: string) => readFileSync(at(`../public${sitePath}`))
const readSource = (relFromRoot: string) => readFileSync(at(relFromRoot), 'utf8')

test('the master logo is stored byte-for-byte, never re-encoded or redrawn', () => {
  const buffer = readFileSync(masterPath)
  assert.equal(buffer.length, MASTER_BYTES, 'master file size changed')
  const digest = createHash('sha256').update(buffer).digest('hex')
  assert.equal(digest, MASTER_SHA256, 'master artwork bytes changed — restore the approved file')
  assert.deepEqual(jpegDimensions(buffer), { width: MASTER_WIDTH, height: MASTER_HEIGHT })
  assert.equal(SITE.logoMaster, '/brand/ogctv-official-logo.jpg')
})

test('the 1/3 derivation stays exact, so the mark cannot be stretched', () => {
  assert.equal(MASTER_WIDTH % SCALE, 0, 'master width must divide by the display scale')
  assert.equal(
    (MASTER_HEIGHT - BLACK_BAND_ROWS) % SCALE,
    0,
    'trimmed height must divide by the scale',
  )
  const masterAspect = MASTER_WIDTH / (MASTER_HEIGHT - BLACK_BAND_ROWS)
  assert.equal(
    MARK_WIDTH / MARK_HEIGHT,
    masterAspect,
    'derived aspect ratio must equal the trimmed master',
  )
})

test('the rendered mark is a lossless PNG at the derived size', () => {
  const dims = pngDimensions(readFileSync(markPath))
  assert.deepEqual(dims, { width: MARK_WIDTH, height: MARK_HEIGHT })
  assert.equal(SITE.logo, '/brand/ogctv-official-logo-trimmed.png')
  assert.equal(SITE.logoWidth, MARK_WIDTH)
  assert.equal(SITE.logoHeight, MARK_HEIGHT)
})

test('site icons and the share card exist at their declared sizes', () => {
  const expectations: Record<string, [number, number]> = {
    [SITE.logoIcons.favicon32]: [32, 32],
    [SITE.logoIcons.favicon48]: [48, 48],
    [SITE.logoIcons.appleTouch180]: [180, 180],
  }
  for (const [file, dims] of Object.entries(expectations)) {
    assert.deepEqual(pngDimensions(readPublic(file)), { width: dims[0], height: dims[1] }, file)
  }
  const card = readPublic(SITE.logoSocial)
  assert.deepEqual(jpegDimensions(card), {
    width: SITE.logoSocialWidth,
    height: SITE.logoSocialHeight,
  })
  assert.equal(SITE.logoSocial, '/brand/og-default.jpg')
})

test('the placeholder artwork and typographic brand mark are fully retired', () => {
  assert.equal(existsSync(at('../public/favicon.svg')), false, 'placeholder favicon must be gone')
  const surfaces = [
    '../src/components/Header.astro',
    '../src/components/Footer.astro',
    '../src/layouts/AdminLayout.astro',
    '../src/pages/admin/login.astro',
    '../src/pages/admin/setup.astro',
  ]
  for (const file of surfaces) {
    const source = readSource(file)
    assert.match(source, /SITE\.logo\b/, `${file} must render the official mark`)
    assert.doesNotMatch(source, /favicon\.svg/, `${file} must not reference the old placeholder`)
    assert.doesNotMatch(source, /class="brand-mark"/, `${file} must not keep the text logo`)
  }
})

test('the logo CSS uses the derived geometry and never crops the mark', () => {
  for (const file of ['../src/styles/global.css', '../src/styles/admin.css']) {
    const css = readSource(file)
    assert.doesNotMatch(css, /1944|1920/, `${file} must not assume the master canvas size`)
    // every rule that styles the brand mark must contain it, never cover-crop it
    const logoRules = [...css.matchAll(/[^{}]*logo[^{}]*\{([^}]*)\}/g)].map((m) => m[1])
    assert.ok(logoRules.length > 0, `${file} has no logo rules`)
    for (const rule of logoRules) {
      if (!rule.includes('object-fit')) continue
      assert.match(rule, /object-fit:contain/, `logo rule would crop the mark: ${rule}`)
    }
    assert.match(css, /648\/631|648 \/ 631/, `${file} must lock the derived aspect ratio`)
  }
})

test('head metadata uses the derived icons and the share card', () => {
  const layout = readSource('../src/layouts/SiteLayout.astro')
  assert.match(layout, /socialImg=img \?\? new URL\(SITE\.logoSocial,\s*SITE\.url\)\.toString\(\)/)
  assert.match(layout, /property="og:image" content=\{socialImg\}/)
  assert.match(layout, /name="twitter:image" content=\{socialImg\}/)
  assert.match(layout, /rel="icon" href=\{SITE\.logoIcons\.favicon32\} type="image\/png"/)
  assert.match(layout, /rel="apple-touch-icon" href=\{SITE\.logoIcons\.appleTouch180\}/)
  assert.match(layout, /og:image:alt/)
})

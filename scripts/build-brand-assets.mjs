// Derives every rendered brand surface from the approved master logo.
//
//   node scripts/build-brand-assets.mjs
//
// public/brand/ogctv-official-logo.jpg is the newsroom's approved artwork and is never modified.
// Everything else under public/brand and public/icons is produced from it by this script using
// exactly three operations, none of which redesign, recolour, crop or stretch the mark:
//
//   1. extract()  removes the solid black band the master was exported with (rows 0-26 only).
//                 No artwork pixel is touched.
//   2. resize()   a single uniform integer scale (1/DISPLAY_SCALE), so the aspect ratio is
//                 preserved exactly — 648/631 is identical to 1944/1893, with no rounding error.
//   3. PNG        lossless output, so no generation loss is added on top of the master's own
//                 JPEG encoding.
//
// Re-run this after replacing the master, then commit the regenerated files.

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const path = (p) => resolve(root, p)

/** Rows 0-26 of the master are a solid black band; the artwork starts at row 27. */
const BLACK_BAND_ROWS = 27
/**
 * Uniform downscale divisor for the displayed mark. 1944 and 1893 are both divisible by 3, so
 * 1/3 keeps the exact aspect ratio and avoids any resampling ambiguity.
 */
const DISPLAY_SCALE = 3

const MASTER = 'public/brand/ogctv-official-logo.jpg'
const DISPLAY = 'public/brand/ogctv-official-logo-trimmed.png'

/** Square site icons, contain-fit on white. */
const ICONS = [
  { file: 'public/icons/favicon-32.png', size: 32 },
  { file: 'public/icons/favicon-48.png', size: 48 },
  { file: 'public/icons/apple-touch-icon-180.png', size: 180 },
]

/** Open Graph / Twitter card: 1.91:1 white canvas with the mark contained and a safe margin. */
const OG = { file: 'public/brand/og-default.jpg', width: 1200, height: 630, margin: 90 }

async function write(rel, pipeline) {
  mkdirSync(dirname(path(rel)), { recursive: true })
  const info = await pipeline.toFile(path(rel))
  console.log(
    `  ${rel.padEnd(44)} ${String(info.width)}x${String(info.height)}`.padEnd(66) +
      `${info.size} bytes`,
  )
  return info
}

const meta = await sharp(path(MASTER)).metadata()
if (!meta.width || !meta.height) throw new Error('cannot read master dimensions')

const trimmedHeight = meta.height - BLACK_BAND_ROWS
const displayWidth = meta.width / DISPLAY_SCALE
const displayHeight = trimmedHeight / DISPLAY_SCALE
if (!Number.isInteger(displayWidth) || !Number.isInteger(displayHeight)) {
  throw new Error(
    `DISPLAY_SCALE ${DISPLAY_SCALE} does not divide ${meta.width}x${trimmedHeight} evenly — ` +
      'pick a divisor that keeps the aspect ratio exact instead of rounding',
  )
}

console.log(`master ${MASTER} ${meta.width}x${meta.height}`)
console.log(
  `  dropping rows 0-${BLACK_BAND_ROWS - 1} (black band) -> ${meta.width}x${trimmedHeight}`,
)
console.log(
  `  displaying at 1/${DISPLAY_SCALE} -> ${displayWidth}x${displayHeight} (aspect unchanged)\n`,
)

const trimmed = sharp(path(MASTER)).extract({
  left: 0,
  top: BLACK_BAND_ROWS,
  width: meta.width,
  height: trimmedHeight,
})

await write(
  DISPLAY,
  trimmed
    .clone()
    .resize(displayWidth, displayHeight, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9, effort: 10 }),
)

const displayBuffer = await sharp(path(DISPLAY)).toBuffer()

for (const icon of ICONS) {
  await write(
    icon.file,
    sharp(displayBuffer)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: '#ffffff',
        withoutEnlargement: false,
      })
      .png(),
  )
}

const ogInner = await sharp(displayBuffer)
  .resize(OG.width - OG.margin * 2, OG.height - OG.margin * 2, {
    fit: 'contain',
    background: '#ffffff',
  })
  .toBuffer()

await write(
  OG.file,
  sharp({ create: { width: OG.width, height: OG.height, channels: 3, background: '#ffffff' } })
    .composite([{ input: ogInner, gravity: 'centre' }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }),
)

console.log('\n  master left byte-identical (this script only ever reads it)')

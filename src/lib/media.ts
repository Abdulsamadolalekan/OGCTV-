/**
 * Media library. Uploaded images are processed with sharp (open-source):
 * re-encoded, resized to sane editorial widths and stored under
 * data/media/… then served through /media/* with immutable caching.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { getDb, MEDIA_DIR, type MediaItem } from './db'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // 12 MB
const MAX_DIMENSION = 2000
export const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function listMedia(): MediaItem[] {
  return getDb()
    .prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC')
    .all() as unknown as MediaItem[]
}

export function getMediaById(id: number): MediaItem | undefined {
  return getDb().prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaItem | undefined
}

export interface ProcessedImage {
  buffer: Buffer
  mime: string
  width: number
  height: number
}

/** Re-encode + resize an image buffer to editorial-safe output. */
export async function processImage(input: Buffer, mime: string): Promise<ProcessedImage> {
  let img = sharp(input, { failOn: 'error' }).rotate() // respect EXIF orientation
  const meta = await img.metadata()
  const animated = mime === 'image/gif'
  if (meta.width && meta.width > MAX_DIMENSION) {
    img = img.resize({ width: MAX_DIMENSION, withoutEnlargement: true })
  }
  if (animated) {
    const out = await img.gif().toBuffer({ resolveWithObject: true })
    return { buffer: out.data, mime: 'image/gif', width: out.info.width, height: out.info.height }
  }
  if (mime === 'image/png') {
    const out = await img
      .png({ compressionLevel: 9, palette: true })
      .toBuffer({ resolveWithObject: true })
    return { buffer: out.data, mime: 'image/png', width: out.info.width, height: out.info.height }
  }
  const out = await img
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  return { buffer: out.data, mime: 'image/jpeg', width: out.info.width, height: out.info.height }
}

/** Store an uploaded image, returning its media-library record. */
export async function saveUpload(
  file: { buffer: Buffer; type: string; name?: string },
  meta: { alt?: string; caption?: string; credit?: string },
): Promise<{ ok: true; item: MediaItem } | { ok: false; error: string }> {
  if (!file?.buffer?.length) return { ok: false, error: 'No file received.' }
  if (file.buffer.length > MAX_UPLOAD_BYTES)
    return { ok: false, error: 'File is larger than 12 MB.' }
  if (!ACCEPTED_MIMES.has(file.type)) {
    return { ok: false, error: 'Only JPG, PNG, WebP or GIF images are accepted.' }
  }

  let processed: ProcessedImage
  try {
    processed = await processImage(file.buffer, file.type)
  } catch {
    return { ok: false, error: 'That file could not be read as an image.' }
  }

  const ext =
    processed.mime === 'image/png' ? 'png' : processed.mime === 'image/gif' ? 'gif' : 'jpg'
  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`
  mkdirSync(MEDIA_DIR, { recursive: true })
  writeFileSync(join(MEDIA_DIR, filename), processed.buffer)

  const now = new Date().toISOString()
  const db = getDb()
  const info = db
    .prepare(
      'INSERT INTO media (filename, path, mime, width, height, size, alt, caption, credit, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      filename,
      `/media/${filename}`,
      processed.mime,
      processed.width,
      processed.height,
      processed.buffer.length,
      meta.alt?.slice(0, 300) ?? '',
      meta.caption?.slice(0, 300) ?? '',
      meta.credit?.slice(0, 200) ?? '',
      now,
    )
  const item = getMediaById(Number(info.lastInsertRowid))
  if (!item) return { ok: false, error: 'Upload was stored but could not be indexed.' }
  return { ok: true, item }
}

export function deleteMedia(id: number): { ok: boolean; error?: string } {
  const db = getDb()
  const item = getMediaById(id)
  if (!item) return { ok: false, error: 'Media item not found.' }
  const used = (
    db.prepare('SELECT COUNT(*) AS n FROM articles WHERE image = ?').get(item.path) as { n: number }
  ).n
  if (used > 0) return { ok: false, error: `In use by ${used} article(s). Detach it first.` }
  db.prepare('DELETE FROM media WHERE id = ?').run(id)
  try {
    unlinkSync(join(MEDIA_DIR, item.filename))
  } catch {
    // file already gone — fine
  }
  return { ok: true }
}

export function updateMediaMeta(
  id: number,
  meta: { alt: string; caption: string; credit: string },
): boolean {
  const r = getDb()
    .prepare('UPDATE media SET alt=?, caption=?, credit=? WHERE id=?')
    .run(meta.alt.slice(0, 300), meta.caption.slice(0, 300), meta.credit.slice(0, 200), id)
  return r.changes > 0
}

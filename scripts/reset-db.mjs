#!/usr/bin/env node
// Development helper: delete the local runtime data directory — the SQLite database, its WAL
// sidecars and everything under data/media.
//
//   node scripts/reset-db.mjs              # dry run: prints what would be removed, deletes nothing
//   node scripts/reset-db.mjs --yes        # reset an empty or throwaway development database
//   node scripts/reset-db.mjs --yes --discard-data
//                                          # additionally required when the database holds accounts,
//                                          # articles or uploads, so a populated store is never wiped
//                                          # by a single mistyped flag
//
// The next app start recreates the directory and reseeds clearly labelled sample content.
//
// This script is deliberately hostile to accidents. It refuses outright while NODE_ENV=production
// (no override exists), it refuses to target a root or top-level directory, it never deletes without
// an explicit flag, and it always prints the absolute path it is about to remove.
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(process.env.OGCTV_DATA_DIR || 'data')
const DB_PATH = resolve(DATA_DIR, 'ogctv.db')
const MEDIA_DIR = resolve(DATA_DIR, 'media')
const FLAGS = new Set(process.argv.slice(2))
const CONFIRMED = FLAGS.has('--yes')
const DISCARD = FLAGS.has('--discard-data')

function stop(message, hint) {
  console.error(`\n  ✗ ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

/** Read-only inventory of the data directory, so a dry run can never write anything. */
function inventory() {
  if (!existsSync(DB_PATH)) return { database: false }
  let db
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
    const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
    return {
      database: true,
      users: count('users'),
      articles: count('articles'),
      media: existsSync(MEDIA_DIR) ? readdirSync(MEDIA_DIR).length : 0,
    }
  } catch {
    return { database: true, unreadable: true }
  } finally {
    if (db) db.close()
  }
}

if (process.env.NODE_ENV === 'production') {
  stop(
    'refusing to wipe the database while NODE_ENV=production.',
    'This deletes the content database and every uploaded media file, and there is no override flag. ' +
      'On a server, restore from backup instead. On a development checkout, run it with NODE_ENV unset.',
  )
}

if (DATA_DIR.split(sep).filter(Boolean).length < 2) {
  stop(
    `refusing to delete ${DATA_DIR === sep ? '/' : DATA_DIR}: that is a root or top-level directory.`,
    'Point OGCTV_DATA_DIR at a dedicated data directory, for example /var/lib/ogctv or ./data.',
  )
}

const counts = inventory()
console.log(`\n  OGCTV data directory: ${DATA_DIR}`)
if (counts.unreadable) {
  console.log('  database: present but unreadable — stop the server first, then retry')
} else if (counts.database) {
  console.log(
    `  contents: ${counts.users} staff account(s), ${counts.articles} article(s), ${counts.media} uploaded media file(s)`,
  )
} else {
  console.log('  contents: no database yet')
}
if (relative(PROJECT_ROOT, DATA_DIR).startsWith('..')) {
  console.log('  note: the path is outside the repository, so OGCTV_DATA_DIR is in effect')
}

if (!existsSync(DATA_DIR)) {
  console.log('\n  Nothing to remove. Done.\n')
  process.exit(0)
}

if (counts.unreadable) {
  stop(
    `cannot inspect ${DB_PATH}; refusing to delete blind.`,
    'Stop the app, or check file permissions.',
  )
}

const populated = counts.database && (counts.users > 0 || counts.articles > 0 || counts.media > 0)

if (!CONFIRMED || (populated && !DISCARD)) {
  console.log('\n  Dry run — nothing was deleted. To proceed:\n')
  console.log('      node scripts/reset-db.mjs --yes')
  if (populated) {
    console.log(
      '      node scripts/reset-db.mjs --yes --discard-data   # required: this store has content\n',
    )
  } else {
    console.log('')
  }
  process.exit(1)
}

try {
  rmSync(DATA_DIR, { recursive: true, force: true })
} catch (error) {
  stop(`could not remove ${DATA_DIR}`, error instanceof Error ? error.message : String(error))
}

console.log(`\n  Removed ${DATA_DIR}. OGCTV will create and seed a fresh database on next start.\n`)

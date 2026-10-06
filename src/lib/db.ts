/**
 * OGCTV content database.
 *
 * SQLite (better-sqlite3) — free, open-source, file-backed. The whole
 * newsroom (articles, categories, authors, media, users, sessions) lives in
 * `data/ogctv.db`. The data layer is intentionally small and typed so it can
 * later be swapped for Postgres without touching page code (see
 * docs/ARCHITECTURE.md → "Swapping the database").
 */

import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

/** Root of the runtime data directory (db file + uploaded media). */
export const DATA_DIR = resolve(process.env.OGCTV_DATA_DIR || 'data')
export const DB_PATH = join(DATA_DIR, 'ogctv.db')
export const MEDIA_DIR = join(DATA_DIR, 'media')

export type ArticleKind = 'story' | 'video'
export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface Category {
  id: number
  slug: string
  name: string
  description: string
  position: number
  is_active: number
}

export interface Author {
  id: number
  slug: string
  name: string
  role_title: string
  bio: string
  is_active: number
}

export interface Article {
  id: number
  slug: string
  kind: ArticleKind
  title: string
  deck: string
  body: string
  category_id: number
  author_id: number
  status: ArticleStatus
  featured: number
  breaking: number
  breaking_at: string | null
  trending: number
  image: string | null
  image_alt: string
  image_caption: string
  image_credit: string
  video_url: string | null
  video_duration: string
  programme: string
  tags: string
  published_at: string | null
  updated_at: string
  created_at: string
  is_sample: number
}

/** Article joined with its category + author (what pages actually render). */
export interface FullArticle extends Article {
  category_slug: string
  category_name: string
  author_slug: string
  author_name: string
  author_role: string
}

export interface MediaItem {
  id: number
  filename: string
  path: string
  mime: string
  width: number
  height: number
  size: number
  alt: string
  caption: string
  credit: string
  created_at: string
}

export interface UserRow {
  id: number
  email: string
  name: string
  password_hash: string
  role: 'admin' | 'editor'
  created_at: string
  last_login_at: string | null
}

export interface SessionRow {
  token_hash: string
  user_id: number
  created_at: string
  expires_at: string
}

declare global {
  // eslint-disable-next-line no-var
  var __ogctvDb: Database.Database | undefined
}

/** Get (and lazily create) the process-wide DB connection. */
export function getDb(): Database.Database {
  if (globalThis.__ogctvDb) return globalThis.__ogctvDb
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(MEDIA_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  migrate(db)
  globalThis.__ogctvDb = db
  return db
}

function migrate(db: Database.Database) {
  const version = (db.pragma('user_version', { simple: true }) as number) || 0
  if (version >= 1) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role_title TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      mime TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      alt TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      credit TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'story' CHECK (kind IN ('story','video')),
      title TEXT NOT NULL,
      deck TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL REFERENCES categories(id),
      author_id INTEGER NOT NULL REFERENCES authors(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
      featured INTEGER NOT NULL DEFAULT 0,
      breaking INTEGER NOT NULL DEFAULT 0,
      breaking_at TEXT,
      trending INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      image_alt TEXT NOT NULL DEFAULT '',
      image_caption TEXT NOT NULL DEFAULT '',
      image_credit TEXT NOT NULL DEFAULT '',
      video_url TEXT,
      video_duration TEXT NOT NULL DEFAULT '',
      programme TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_sample INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_articles_status_published
      ON articles(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category_status
      ON articles(category_id, status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_kind ON articles(kind, status);
    CREATE INDEX IF NOT EXISTS idx_articles_breaking
      ON articles(breaking, status, breaking_at DESC);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Full-text search index (FTS5 ships compiled into better-sqlite3).
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS article_fts USING fts5(
      article_id UNINDEXED,
      title, deck, body, tags, author_name, category_name,
      tokenize = 'porter unicode61'
    );
  `)

  db.pragma('user_version = 1')
}

/** Keep the FTS index in sync for one article (called on every write). */
export function syncFts(db: Database.Database, articleId: number) {
  db.prepare('DELETE FROM article_fts WHERE article_id = ?').run(articleId)
  db.prepare(
    `INSERT INTO article_fts (article_id, title, deck, body, tags, author_name, category_name)
     SELECT a.id, a.title, a.deck, a.body, a.tags, au.name, c.name
     FROM articles a
     JOIN authors au ON au.id = a.author_id
     JOIN categories c ON c.id = a.category_id
     WHERE a.id = ?`,
  ).run(articleId)
}

/**
 * OGCTV newsroom authentication.
 *
 * Real, boring, correct security — no third-party service, no fake gating:
 * - passwords hashed with scrypt (node:crypto), random salt per user
 * - sessions are random 256-bit tokens; only their SHA-256 is stored
 * - session cookie is httpOnly + SameSite=Lax (+ Secure over HTTPS)
 * - login attempts are rate-limited per IP
 * - state-changing admin requests must pass an Origin check (CSRF)
 *
 * The first newsroom account is created through the one-time /admin/setup
 * flow when no users exist. Credentials are never stored in code.
 */
import { scrypt as _scrypt, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { AstroCookies } from 'astro'

type AstroRequest = Request

import { getDb, type UserRow } from './db'

const SESSION_COOKIE = 'ogctv_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours
const SCRYPT_N = 16384
const SCRYPT_KEYLEN = 64

export interface SessionUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor'
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    _scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, { N: SCRYPT_N }, (err, key) =>
      err ? reject(err) : resolve(key),
    )
  })
}

/** Hash a password → "scrypt$N$salt_b64$hash_b64" (safe to store). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt)
  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${key.toString('base64')}`
}

/** Constant-time password verification. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[2], 'base64')
  const expected = Buffer.from(parts[3], 'base64')
  const key = await scrypt(password, salt)
  if (key.length !== expected.length) return false
  return timingSafeEqual(key, expected)
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// ---------------------------------------------------------------------------
// Login rate limiting (in-memory, per process — resets on restart, which is
// acceptable for a brute-force speed bump on a single-node deployment).
// ---------------------------------------------------------------------------
const attempts = new Map<string, { count: number; firstAt: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10

export function checkLoginAllowed(ip: string): boolean {
  const rec = attempts.get(ip)
  if (!rec) return true
  if (Date.now() - rec.firstAt > WINDOW_MS) {
    attempts.delete(ip)
    return true
  }
  return rec.count < MAX_ATTEMPTS
}

export function recordLoginFailure(ip: string) {
  const rec = attempts.get(ip)
  if (rec && Date.now() - rec.firstAt <= WINDOW_MS) {
    rec.count++
  } else {
    attempts.set(ip, { count: 1, firstAt: Date.now() })
  }
}

export function clearLoginFailures(ip: string) {
  attempts.delete(ip)
}

export function clientIp(req: AstroRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// ---------------------------------------------------------------------------
// Users + sessions
// ---------------------------------------------------------------------------

export function userCount(): number {
  const db = getDb()
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as
    | UserRow
    | undefined
}

export async function createFirstAdmin(input: {
  email: string
  name: string
  password: string
}): Promise<UserRow> {
  const db = getDb()
  if (userCount() > 0) throw new Error('Setup already completed')
  const hash = await hashPassword(input.password)
  const now = new Date().toISOString()
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)')
    .run(input.email.toLowerCase().trim(), input.name.trim(), hash, 'admin', now)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow
}

/** Validate credentials; on success mints a session and sets the cookie. */
export async function login(
  cookies: AstroCookies,
  email: string,
  password: string,
  ip: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!checkLoginAllowed(ip)) {
    return { ok: false, error: 'Too many sign-in attempts. Try again in a few minutes.' }
  }
  const user = getUserByEmail(email)
  const valid = user ? await verifyPassword(password, user.password_hash) : false
  if (!user || !valid) {
    recordLoginFailure(ip)
    // Uniform message — never reveal whether the email exists.
    return { ok: false, error: 'Incorrect email or password.' }
  }
  clearLoginFailures(ip)

  const db = getDb()
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)',
  ).run(
    sha256(token),
    user.id,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  )
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    user.id,
  )

  setSessionCookie(cookies, token, now + SESSION_TTL_MS)
  return { ok: true }
}

export function logout(cookies: AstroCookies, token: string | undefined) {
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
  }
  cookies.delete(SESSION_COOKIE, { path: '/' })
}

function setSessionCookie(cookies: AstroCookies, token: string, expiresMs: number) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(expiresMs / 1000),
  })
}

/** Resolve the current session user from the request cookie. */
export function getSessionUser(_req: AstroRequest, cookies: AstroCookies): SessionUser | null {
  const token = cookies.get(SESSION_COOKIE)?.value
  if (!token || token.length > 512) return null
  const row = getDb()
    .prepare(
      `SELECT s.token_hash, s.expires_at, u.id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as
    | {
        token_hash: string
        expires_at: string
        id: number
        email: string
        name: string
        role: 'admin' | 'editor'
      }
    | undefined
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash)
    return null
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

/**
 * CSRF protection for admin mutations: the Origin header must match the
 * request host (SameSite=Lax already blocks most cross-site posts).
 */
export function originOk(req: AstroRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // same-origin form posts from older browsers
  try {
    const o = new URL(origin)
    const forwardedProto = req.headers.get('x-forwarded-proto')
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
    return o.host === host && (forwardedProto ? o.protocol === `${forwardedProto}:` : true)
  } catch {
    return false
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE

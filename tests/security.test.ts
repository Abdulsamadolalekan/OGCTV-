import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Every assertion that reads source is scoped to this helper so tests fail loudly, not silently. */
function source(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function tempDir(prefix: string) {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** better-sqlite3 returns `unknown`; each test names the row shape it reads. */
function row<T>(db: InstanceType<typeof Database>, sql: string, ...params: unknown[]): T {
  return db.prepare(sql).get(...params) as T
}

// ---------------------------------------------------------------------------
// Password change + offline recovery, against a throwaway database.
// ---------------------------------------------------------------------------

const scratch = tempDir('ogctv-security-')
process.env.OGCTV_DATA_DIR = scratch

// The whole file shares one throwaway database; it must not outlive the run.
after(() => rmSync(scratch, { recursive: true, force: true }))

async function authModule() {
  return import('../src/lib/auth.ts')
}

test('a staff member can change their own password, and every other session dies', async () => {
  const auth = await authModule()
  const { getDb } = await import('../src/lib/db.ts')
  const created = await auth.createFirstAdmin({
    email: 'desk@e.test',
    name: 'Desk Editor',
    password: 'original-newsroom-passphrase',
  })

  const wrongCurrent = await auth.changePassword(
    created.id,
    'not-the-current-one',
    'replacement-newsroom-pass',
  )
  assert.equal(wrongCurrent.ok, false)
  assert.match(wrongCurrent.error, /current password is not correct/i)

  const tooShort = await auth.changePassword(created.id, 'original-newsroom-passphrase', 'short1')
  assert.equal(tooShort.ok, false)
  assert.match(tooShort.error, /at least 12 characters/)

  const sameAsCurrent = await auth.changePassword(
    created.id,
    'original-newsroom-passphrase',
    'original-newsroom-passphrase',
  )
  assert.equal(sameAsCurrent.ok, false)

  // A live session must exist so the change can be proven to destroy it.
  getDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(
      'a'.repeat(64),
      created.id,
      new Date().toISOString(),
      new Date(Date.now() + 3600_000).toISOString(),
    )
  assert.equal(row<{ n: number }>(getDb(), 'SELECT COUNT(*) AS n FROM sessions').n, 1)

  const changed = await auth.changePassword(
    created.id,
    'original-newsroom-passphrase',
    'replacement-newsroom-passphrase',
  )
  assert.equal(changed.ok, true)
  assert.equal(changed.signedOut, 1, 'changing the password must sign out other devices')
  assert.equal(row<{ n: number }>(getDb(), 'SELECT COUNT(*) AS n FROM sessions').n, 0)

  const stored = row<{ password_hash: string }>(
    getDb(),
    'SELECT password_hash FROM users WHERE id = ?',
    created.id,
  ).password_hash
  assert.equal(await auth.verifyPassword('replacement-newsroom-passphrase', stored), true)
  assert.equal(await auth.verifyPassword('original-newsroom-passphrase', stored), false)
  assert.equal(await auth.verifyPassword('REPLACEMENT-NEWSROOM-PASSPHRASE', stored), false)
})

test('recovery refuses unknown accounts and weak passwords instead of half-working', async () => {
  const auth = await authModule()
  const { getDb } = await import('../src/lib/db.ts')

  const unknown = await auth.resetPasswordForEmail('ghost@e.test', 'another-newsroom-passphrase')
  assert.equal(unknown.ok, false)
  assert.match(unknown.error, /no newsroom account/i)

  const weak = await auth.resetPasswordForEmail('desk@e.test', 'weak')
  assert.equal(weak.ok, false)
  assert.match(weak.error, /at least 12 characters/)

  const before = row<{ h: string }>(
    getDb(),
    'SELECT password_hash AS h FROM users WHERE email = ?',
    'desk@e.test',
  ).h
  const recovered = await auth.resetPasswordForEmail(
    'DESK@e.test  ',
    'recovered-newsroom-passphrase',
  )
  assert.equal(recovered.ok, true)
  assert.equal(recovered.name, 'Desk Editor')
  const after = row<{ h: string }>(
    getDb(),
    'SELECT password_hash AS h FROM users WHERE email = ?',
    'desk@e.test',
  ).h
  assert.notEqual(after, before, 'the stored hash must actually be replaced')
  assert.equal(await auth.verifyPassword('recovered-newsroom-passphrase', after), true)
})

test('recovery reports the policy from one place, not a second copy', async () => {
  const auth = await authModule()
  assert.equal(auth.MIN_PASSWORD_LENGTH, 12)
  assert.match(
    source('src/pages/admin/setup.astro'),
    /password\.length<12/,
    'setup keeps enforcing the same floor',
  )
  assert.match(source('src/pages/admin/account.astro'), /minlength=\{MIN_PASSWORD_LENGTH\}/)
})

// ---------------------------------------------------------------------------
// The destructive reset script must be very hard to aim at the wrong thing.
// ---------------------------------------------------------------------------

/**
 * Children must never inherit this file's scratch OGCTV_DATA_DIR, and a null value in
 * `extra` means "delete this variable" so each test controls NODE_ENV explicitly.
 */
function childEnv(extra: Record<string, string | null> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) delete env[key]
    else env[key] = value
  }
  return env
}

function runReset(cwd: string, args: string[], extra: Record<string, string | null> = {}) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', 'reset-db.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: childEnv({ OGCTV_DATA_DIR: null, NODE_ENV: null, ...extra }),
  })
}

test('reset refuses outright under NODE_ENV=production, deleting nothing', () => {
  const dir = tempDir('ogctv-reset-prod-')
  mkdirSync(join(dir, 'data'))
  writeFileSync(join(dir, 'data', 'ogctv.db'), 'do not touch me')
  const result = runReset(dir, ['--yes', '--discard-data'], { NODE_ENV: 'production' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /refusing to wipe the database while NODE_ENV=production/)
  assert.equal(existsSync(join(dir, 'data', 'ogctv.db')), true)
  rmSync(dir, { recursive: true, force: true })
})

test('reset is a dry run unless --yes is passed', () => {
  const dir = tempDir('ogctv-reset-dry-')
  mkdirSync(join(dir, 'data'))
  writeFileSync(join(dir, 'data', 'keep.db'), 'x')
  const result = runReset(dir, [])
  assert.equal(result.status, 1)
  assert.match(result.stdout, /Dry run — nothing was deleted/)
  assert.equal(existsSync(join(dir, 'data', 'keep.db')), true)
  rmSync(dir, { recursive: true, force: true })
})

test('reset wipes an empty development directory with --yes, and a populated one only with --discard-data', () => {
  const empty = tempDir('ogctv-reset-empty-')
  mkdirSync(join(empty, 'data'))
  assert.equal(runReset(empty, ['--yes']).status, 0)
  assert.equal(existsSync(join(empty, 'data')), false, 'an empty dev data dir should go')
  rmSync(empty, { recursive: true, force: true })

  const busy = tempDir('ogctv-reset-busy-')
  mkdirSync(join(busy, 'data'))
  const db = new Database(join(busy, 'data', 'ogctv.db'))
  db.exec(
    'CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users (id) VALUES (1);' +
      'CREATE TABLE articles (id INTEGER PRIMARY KEY); INSERT INTO articles (id) VALUES (1),(2);',
  )
  db.close()

  const guarded = runReset(busy, ['--yes'])
  assert.equal(guarded.status, 1, 'a database holding content must need a second flag')
  assert.match(guarded.stdout, /2 article\(s\)/)
  assert.equal(existsSync(join(busy, 'data', 'ogctv.db')), true)

  const forced = runReset(busy, ['--yes', '--discard-data'])
  assert.equal(forced.status, 0)
  assert.equal(existsSync(join(busy, 'data')), false)
  rmSync(busy, { recursive: true, force: true })
})

function runRecovery(args: string[], input = 'nope\n') {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', join(ROOT, 'scripts', 'recover-password.mjs'), ...args],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input,
      env: childEnv({ OGCTV_DATA_DIR: null, NODE_ENV: null }),
    },
  )
}

test('recovery refuses a passphrase handed in as an argument', () => {
  const result = runRecovery(['--password', 'hunter2-not-a-flag'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /A password can never be passed in/)
})

test('recovery refuses to read credentials from a pipe', () => {
  const result = runRecovery([])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /only runs on an interactive terminal/)
})

test('recovery masks what it reads and never repeats it back', () => {
  const script = source('scripts/recover-password.mjs')
  // Both passphrase prompts are hidden; only the email and the confirmation word are echoed.
  assert.equal(
    script.match(/\{ hidden: true \}/g)?.length,
    2,
    'both passphrase prompts must be masked',
  )
  for (const label of ['const first = await ask(', 'const second = await ask(']) {
    const line = script.split('\n').find((entry) => entry.includes(label)) ?? ''
    assert.match(line, /\{ hidden: true \}\)$/, `${label.trim()} must read the passphrase masked`)
  }
  assert.match(script, /process\.stdout\.write\(masking \? '•' : char\)/)
  // The passphrase is only ever compared or handed to the reset function — it is
  // never interpolated into anything the tool prints.
  assert.doesNotMatch(
    script,
    /\$\{\s*(first|second)\s*\}/,
    'the passphrase must never appear in output',
  )
  assert.match(
    script,
    /const settle = waiting[\s\S]*queued\.push\(answer\.trim\(\)\)/,
    'typed-ahead input is queued, not lost',
  )
  // It states which database file it is about to write, so the operator can see the target.
  assert.match(script, /database:\s*\$\{DB_PATH\}/)
})

// ---------------------------------------------------------------------------
// Headers, framing and metadata.
// ---------------------------------------------------------------------------

test('the newsroom surface cannot be framed, and its redirects say so too', () => {
  const middleware = source('src/middleware.ts')
  assert.match(middleware, /frame-ancestors 'none'/)
  assert.match(middleware, /X-Frame-Options', 'DENY'/)
  assert.match(middleware, /function isAdminPath/, 'admin detection must be one definition')
  // Redirects go through the same header helper as rendered pages.
  const redirects = middleware.match(/secure\(\s*context\.redirect\(/g) ?? []
  assert.equal(redirects.length, 3, 'every admin redirect must be wrapped in secure()')
  assert.match(middleware, /return secure\(await next\(\), admin, context\.url\.protocol\)/)
  // The public CSP must keep allowing the players the site embeds.
  assert.match(
    middleware,
    /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/,
  )
})

test('the legacy favicon probe is answered by redirect, not a duplicated asset', () => {
  const middleware = source('src/middleware.ts')
  assert.match(middleware, /path === '\/favicon\.ico'/)
  assert.match(middleware, /status: 301/)
  assert.match(middleware, /SITE\.logoIcons\.favicon48/)
  assert.equal(
    existsSync(join(ROOT, 'public', 'favicon.ico')),
    false,
    'no duplicate icon may be committed',
  )
})

test('X shares use the large card for the 1200x630 image', () => {
  const layout = source('src/layouts/SiteLayout.astro')
  assert.match(layout, /<meta name="twitter:card" content="summary_large_image">/)
  assert.doesNotMatch(layout, /content=\{img\?'summary_large_image':'summary'\}/)
})

test('the runtime is pinned to what the framework actually requires', () => {
  const pkg = JSON.parse(source('package.json'))
  assert.equal(pkg.engines.node, '>=22.12.0')
  assert.equal(pkg.engines.npm, '>=9.6.5')
  assert.match(source('.npmrc'), /engine-strict=true/)
  for (const file of ['README.md', 'docs/ARCHITECTURE.md', 'package.json']) {
    assert.doesNotMatch(
      source(file),
      /Node 20|node.*>=20["']/i,
      `${file} must not claim Node 20 works`,
    )
  }
  assert.equal(pkg.scripts.seed, undefined, 'the misnamed destructive "seed" script must be gone')
  assert.match(pkg.scripts['db:reset'], /reset-db\.mjs/)
  assert.match(pkg.scripts['db:recover-password'], /recover-password\.mjs/)
})

test('nothing in the tree hardcodes or seeds a credential', () => {
  const account = source('src/pages/admin/account.astro')
  assert.match(account, /originOk\(Astro\.request\)/, 'the form must keep the CSRF check')
  assert.match(account, /await changePassword\(user\.id, current, replacement\)/)
  assert.match(
    account,
    /await login\(Astro\.cookies, user\.email, replacement, clientIp\(Astro\.request\)\)/,
  )
  assert.doesNotMatch(
    account,
    /password\s*=\s*['"][^'"]{6,}['"]/i,
    'no credential may be written into a page',
  )
  assert.doesNotMatch(source('scripts/recover-password.mjs'), /process\.argv.*password/i)
})

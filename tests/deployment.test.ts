import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/**
 * These files are the deployment. Nothing here tests the app — it tests that the platform
 * contract files agree with each other and with what `astro build` actually produces, because
 * a mismatch between them is exactly the class of bug that yields a deployed-but-empty site.
 */

test('the canonical origin resolves in one order, in both places that use it', () => {
  const origin =
    /process\.env\.PUBLIC_SITE_URL \|\| process\.env\.RENDER_EXTERNAL_URL \|\| 'http:\/\/localhost:4321'/
  // astro.config.mjs feeds the adapter, sitemap and robots; SITE.url feeds every canonical,
  // og:url and RSS <link> in the HTML. A fallback in only one of them is a bug.
  for (const file of ['astro.config.mjs', 'src/lib/config.ts']) {
    const source = read(file).replace(/\s+/g, ' ')
    assert.match(
      source,
      origin,
      `${file} must resolve PUBLIC_SITE_URL, then the platform URL, then localhost`,
    )
  }
  const config = read('astro.config.mjs')
  assert.match(
    config,
    /output: 'server'/,
    'the app is server-rendered; a static host has nothing to serve',
  )
  assert.match(
    config,
    /adapter: node\(\{ mode: 'standalone' \}\)/,
    'the Node server is the artifact',
  )
})

test('the runtime floor is declared where installers read it', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.engines.node, '>=22.12.0')
  assert.match(read('.npmrc'), /engine-strict=true/)
  assert.match(
    pkg.scripts.build,
    /^astro build$/,
    'the platform buildCommand relies on this script name',
  )
  assert.match(pkg.scripts.start, /dist\/server\/entry\.mjs/, 'and on this entry point')
})

test('Render blueprint points the data directory at the persistent disk', () => {
  const yaml = read('render.yaml')
  const mount = yaml.match(/mountPath:\s*(\S+)/)?.[1]
  const dataDir = yaml.match(/key:\s*OGCTV_DATA_DIR\s*\n\s*value:\s*(\S+)/)?.[1]
  assert.ok(mount, 'the service must declare a disk mountPath')
  assert.equal(
    dataDir,
    mount,
    'OGCTV_DATA_DIR must equal the disk mountPath or content is lost on redeploy',
  )
  assert.match(yaml, /buildCommand:\s*npm ci && npm run build/)
  assert.match(yaml, /startCommand:\s*node \.\/dist\/server\/entry\.mjs/)
  assert.match(yaml, /healthCheckPath:\s*\//)
  assert.match(yaml, /runtime:\s*node/)
  assert.match(yaml, /plan:\s*starter/, 'persistent disks require a paid instance type')
  assert.match(yaml, /sizeGB:\s*\d+/)
  // Secrets and per-deploy origins are prompted for, never committed.
  assert.match(yaml, /key:\s*PUBLIC_SITE_URL\s*\n\s*sync:\s*false/)
  assert.doesNotMatch(
    yaml,
    /key:\s*PUBLIC_SITE_URL\s*\n\s*value:/,
    'no hardcoded origin in the blueprint',
  )
})

test('the Dockerfile runtime contract matches the server the build produces', () => {
  const docker = read('Dockerfile')
  const volume = docker.match(/VOLUME\s+(\S+)/)?.[1]
  const dataDir = docker.match(/ENV OGCTV_DATA_DIR=(\S+)/)?.[1]
  assert.equal(dataDir, volume, 'the declared volume must be the data directory')
  assert.match(docker, /ENV HOST=0\.0\.0\.0/, 'a container must not bind localhost')
  assert.match(docker, /ENV NODE_ENV=production/)
  assert.match(docker, /USER node/, 'and must not run as root')
  assert.match(docker, /CMD \["node", "\.\/dist\/server\/entry\.mjs"\]/)
  assert.match(docker, /HEALTHCHECK/, 'platforms use it to decide whether the deploy is live')
  assert.match(docker, /FROM node:22-bookworm-slim AS build/)
  assert.match(docker, /npm ci && npm run build/)
})

test('.dockerignore cannot starve the build it describes', () => {
  const dockerignore = read('.dockerignore')
  const ignored = new Set(
    dockerignore
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  )
  // Everything on the left is COPYed by the build stage and must survive the context filter.
  const required = [
    'package.json',
    'package-lock.json',
    '.npmrc',
    'astro.config.mjs',
    'tsconfig.json',
    'biome.json',
    'src',
    'public',
    'scripts',
  ]
  for (const path of required) {
    assert.equal(ignored.has(path), false, `${path} is COPYed but ignored by .dockerignore`)
  }
  for (const path of ['node_modules', 'dist', 'data', '.git']) {
    assert.equal(ignored.has(path), true, `${path} must stay out of the build context`)
  }
})

test('fly.toml agrees with the image about port, data path and machine count', () => {
  const toml = read('fly.toml')
  const internalPort = toml.match(/internal_port\s*=\s*(\d+)/)?.[1]
  const envPort = toml.match(/PORT\s*=\s*"(\d+)"/)?.[1]
  assert.equal(internalPort, envPort, 'the service port must match the port the server binds')
  assert.match(toml, /OGCTV_DATA_DIR\s*=\s*"\/data"/)
  assert.match(
    toml,
    /destination\s*=\s*"\/data"/,
    'the volume must be mounted where the app writes',
  )
  assert.match(toml, /dockerfile\s*=\s*"Dockerfile"/)
  assert.match(toml, /min_machines_running\s*=\s*1/)
  assert.match(
    toml,
    /auto_stop_machines\s*=\s*false/,
    'stopping a machine loses the login throttle state',
  )
  assert.match(
    toml,
    /chown -R node:node \/data/,
    'Fly mounts volumes as root; the image runs as node',
  )
})

test('the docs name the failure this deployment actually hit, so it is not repeated', () => {
  const docs = read('docs/DEPLOYMENT.md')
  assert.match(docs, /zero HTML files|no HTML/i)
  assert.match(docs, /Vercel/)
  assert.match(docs, /read-only/)
  assert.match(
    docs,
    /x-vercel-error|NOT_FOUND/,
    'the fingerprint of a platform-level 404 is documented',
  )
  const readme = read('README.md').replace(/\s+/g, ' ')
  assert.match(readme, /docs\/DEPLOYMENT\.md/, 'README must point at it')
  assert.match(
    readme,
    /Static or serverless hosts \(Vercel, Netlify, GitHub Pages, S3\) cannot serve this build/,
  )
})

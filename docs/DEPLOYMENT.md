# Deploying OGCTV

## What the build actually is

`astro build` produces a **standalone Node server**, not a static site:

- `dist/server/entry.mjs` renders every public and admin page per request (`output: 'server'`), so
  a published story appears immediately with no rebuild.
- `dist/client/` contains only assets — **zero HTML files**. `robots.txt` is the one prerendered route.
- The process opens a SQLite database (`data/ogctv.db`, WAL mode) and writes uploads to `data/media/`.
  Accounts, sessions, articles and media all live there.

So a deployment target must provide three things:

1. a **long-running Node process** (Node ≥ 22.12 — `package.json` `engines` + `.npmrc` `engine-strict=true`
   make a wrong runtime fail at install instead of mid-build);
2. a **persistent, writable disk** for `OGCTV_DATA_DIR`;
3. **HTTPS** in front (the session cookie is `Secure` when `NODE_ENV=production`).

## Supported targets

| Target | Config in this repo | Notes |
|---|---|---|
| Docker host / VPS | `Dockerfile`, `docs/DEPLOYMENT.md` §systemd | mount a volume at `/data`; `-p 4321:4321`; reverse proxy terminates TLS |
| [Render](https://render.com) | `render.yaml` | Blueprint → this repo. Uses a persistent **disk**, `npm ci && npm run build`, start `node ./dist/server/entry.mjs`, health check `/` |
| [Fly.io](https://fly.io) | `fly.toml` | builds this `Dockerfile`, mounts a volume at `/data`, keep exactly one machine |
| Plain VPS, no Docker | below | `npm ci && npm run build`, systemd unit, nginx/Caddy in front |

```bash
# Docker, in three commands
docker build -t ogctv .
docker volume create ogctv-data
docker run -d --name ogctv -p 4321:4321 -v ogctv-data:/data \
  -e PUBLIC_SITE_URL=https://your-domain.example ogctv
```

```ini
# /etc/systemd/system/ogctv.service  (VPS without Docker)
[Service]
Type=simple
User=ogctv
WorkingDirectory=/srv/ogctv
ExecStart=/usr/bin/node ./dist/server/entry.mjs
Restart=always
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=4321
Environment=OGCTV_DATA_DIR=/var/lib/ogctv
Environment=PUBLIC_SITE_URL=https://your-domain.example
ReadWritePaths=/var/lib/ogctv
MemoryMax=1G
```

Set HSTS at the proxy. The app adds it only when it observes an `https:` request URL itself, which a
TLS-terminating proxy does not pass through by default.

## Not a supported target: static/serverless hosts (Vercel, Netlify, GitHub Pages, S3)

Those platforms serve files or per-request functions; there is no process to keep and no disk to keep
it on. Concretely, for this app:

- the HTML routes do not exist as files, so requests fall through to the platform's own 404 — for
  example Vercel answers every path, including `/robots.txt` and asset paths, with its plain-text
  `NOT_FOUND` body;
- even with a Vercel adapter added, the filesystem is read-only and ephemeral (only `/tmp` is writable,
  per-invocation), so accounts, sessions and uploads would vanish between requests;
- SQLite in WAL mode cannot be shared across functions/machines.

Making Vercel work would mean replacing `src/lib/db.ts`/`queries.ts` storage with a network database
(Turso, Postgres) and re-homing sessions and the login throttle — an architecture change, not a setting.
It is deliberately not done here. On Render/Fly/Docker the same code runs unchanged.

## Environment variables

| Name | Value | Effect |
|---|---|---|
| `NODE_ENV` | `production` | `Secure` session cookie; also blocks `npm run db:reset` |
| `PUBLIC_SITE_URL` | `https://<origin>` | canonical URLs, Open Graph, RSS, sitemap. Unset → `http://localhost:4321` in output |
| `OGCTV_DATA_DIR` | absolute path | where the database and uploads live; defaults to `./data` **relative to the process cwd** |
| `PORT`, `HOST` | platform-assigned / `0.0.0.0` | standalone server bind |

No `SECRET_KEY`, `ADMIN_PASSWORD`, API key or `.env` file is needed or read: scrypt salts and session
tokens are generated at runtime and stored in the database.

## First run, in order

1. Deploy with `PUBLIC_SITE_URL` set. The first request creates and seeds the database (18 sample stories).
2. Open `https://<origin>/admin/setup` **once** and create the first administrator: name, work email you
   control, and a 20–25 character passphrase from your password manager. There are no default credentials,
   and this route closes itself afterwards.
3. Sign out and sign back in at `/admin/login` to prove the credential, then visit `/admin/account` and
   change the passphrase once — that also proves the session rotation path.
4. Start backups of `OGCTV_DATA_DIR` the same day: `sqlite3 "$D/ogctv.db" ".backup …"` plus a tar of `media/`.
5. Archive the sample content from `/admin`; while any published sample exists, public pages send
   `noindex, nofollow` and samples are kept out of RSS and the news sitemap.

A lost passphrase is recovered on the server with `npm run db:recover-password` (terminal-only, masked,
never accepts the passphrase as an argument, clears that account's sessions). There is no emailed reset
link by design — see the README section *If an administrator password is lost*.

## Verify a deployment

```bash
curl -sI https://<origin>/ | head -1                 # 200
curl -sI https://<origin>/robots.txt | head -1       # 200  (prerendered)
curl -sI https://<origin>/favicon.ico | grep -i location   # 301 → /icons/favicon-48.png
curl -s  https://<origin>/ | grep -c 'brand/ogctv-official-logo-trimmed.png'   # ≥ 1
curl -sI https://<origin>/admin | grep -iE 'location|x-frame|cache-control'     # 303 → /admin/setup (first run)
curl -s  https://<origin>/sitemap.xml | grep -c "<origin>"                      # > 0 once PUBLIC_SITE_URL is set
```

If `/` returns the *platform's* 404 for every path including `/robots.txt`, the target is not running the
Node server. If `/admin` bounces you back to `/admin/login` immediately after signing in, the request did
not arrive over HTTPS (the `Secure` cookie was dropped).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Platform 404 on every route, build "succeeded" | treated as a static site; no `@astrojs/vercel`-style server output exists — run it on a Node host |
| `Node.js v20.x is not supported by Astro!` at build | the host picked an old runtime; `engines` + `.npmrc` are there to make this fail early — set Node ≥ 22.12 (or `NODE_VERSION`) |
| `SQLITE_CANTOPEN` / `attempt to write a readonly database` | `OGCTV_DATA_DIR` is read-only, on a network filesystem, or not persisted |
| Site empty, "admin account missing" after a redeploy | the data directory was ephemeral, or the process started from a different cwd → a fresh empty `./data` |
| Login works, then you are signed out | `NODE_ENV=production` without HTTPS |
| Canonical/OG/sitemap URLs say `localhost:4321` | `PUBLIC_SITE_URL` was not set when the server started |
| `403 Cross-site POST form submissions are forbidden` from scripts | Astro's origin guard: send `Sec-Fetch-Site: same-origin` (browsers do this automatically) or omit `Origin` |
| Login throttled and won't clear | 10 failures per 10 minutes per IP, held in memory — a restart clears it; multiple machines need shared storage |

## Scaling

One process per database file. Reads are cheap and the app is SSR-by-design, so scale by giving that
machine more RAM/CPU before considering a database move. To go multi-machine you must first move
`src/lib/db.ts` and `src/lib/queries.ts` to Postgres and relocate sessions plus the login throttle to a
shared store; pages and components contain no SQL, which is what makes that swap contained.

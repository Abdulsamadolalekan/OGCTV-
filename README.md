# OGCTV — Ogun's digital voice

A complete, server-rendered Nigerian digital newsroom for Ogun State and surrounding communities. OGCTV combines local news, breaking-news publishing, full-text search, original video, public trust pages, sharing, and a protected editorial CMS.

## Start locally

```bash
npm install
npm run dev
```

Open `http://localhost:4321`. The first request creates a SQLite database and clearly labelled sample content. Visit `/admin/setup` once to create the first administrator; there are **no default credentials**.

## Commands

```bash
npm run dev       # development server
npm run check     # Astro + TypeScript diagnostics
npm run lint      # Biome checks on application logic and tests
npm test          # Node test suite through tsx
npm run build     # production standalone Node build
npm run preview   # run the built server
npm run verify    # lint, type-check, tests and production build
npm run db:reset             # dry run: shows what removing the local data directory would delete
npm run db:recover-password  # attended, server-side recovery for a lost newsroom password
```

## Major routes

| Route | Purpose |
| --- | --- |
| `/` | Editorial homepage |
| `/latest`, `/breaking` | Latest and active breaking-news desks |
| `/category/:slug` | Functional section pages |
| `/article/:slug` | Premium news article |
| `/tv`, `/tv/:slug` | OGCTV TV hub and video pages |
| `/search` | SQLite FTS5 search across headlines, bodies, tags, authors and categories |
| `/author/:slug` | Author/byline archive |
| `/contact` | WhatsApp newsroom and news-tip composer |
| `/about`, `/editorial-principles`, `/corrections`, `/privacy`, `/terms` | Trust pages |
| `/rss.xml`, `/sitemap.xml`, `/news-sitemap.xml`, `/robots.txt` | Discovery infrastructure |
| `/admin/*` | Protected newsroom CMS, including authenticated draft previews |

## Newsroom CMS

The CMS supports drafts, publication, archiving, permanent deletion, story/video types, featured/trending/breaking placement, categories, authors, programme grouping, media upload and metadata, and a one-click archive operation for demonstration content. Public pages update immediately after publication.

Authentication uses scrypt password hashes and server-side sessions. Runtime content lives under `data/` and is Git-ignored. In production, make this path persistent and back it up. Set `OGCTV_DATA_DIR` to use another location.

## Brand assets

The approved master artwork lives at `public/brand/ogctv-official-logo.jpg` and is stored
byte-for-byte as supplied — its checksum and size are pinned by `tests/brand.test.ts`, and nothing
in the build ever writes to it. The mark the site renders is a committed derivation of it
(`public/brand/ogctv-official-logo-trimmed.png`, plus PNG site icons and a 1200×630 share card),
produced losslessly at exactly 1/3 scale with the same aspect ratio by
`node scripts/build-brand-assets.mjs`.

Header, mobile header, footer, favicon, Open Graph metadata and the newsroom CMS all read the same
paths from `SITE.logo` / `SITE.logoIcons` / `SITE.logoSocial` in `src/lib/config.ts`.
See [docs/BRANDING.md](docs/BRANDING.md) for the checksum, every integration point and the
rendering rules.

## Configuration and deployment

- Node 22.12 or newer is required: `astro@7` enforces `>=22.12.0`, and `.npmrc` sets `engine-strict=true` so an older runtime fails at install instead of half-way through a build.
- Set `NODE_ENV=production` so the session cookie is `Secure`. That also means HTTPS is mandatory off `localhost`: on a plain-HTTP origin a `Secure` cookie is never stored, and signing in loops back to `/admin/login`.
- Put the application behind HTTPS.
- `npm run db:reset` refuses to run under `NODE_ENV=production`, and needs `--yes` (plus `--discard-data` when the store holds content). There is no override; restore from backup instead.
- Set `PUBLIC_SITE_URL` to the confirmed production origin (for example, `https://news.example`) for canonical URLs, social metadata, RSS and sitemap output. No unconfirmed OGCTV domain is assumed.
- The only confirmed contact shipped is WhatsApp `0806 253 2830`; no email, address or social account is invented.
- No paid service is required. YouTube/Vimeo and a real livestream are optional future connections.

### Where it can run

`astro build` emits a standalone Node server plus `dist/client` assets and **no HTML pages** — every
public and admin page is rendered by that process, which also keeps its SQLite database and uploads on
disk. A host therefore needs a long-running Node process, a persistent writable volume and HTTPS.
`Dockerfile`, `render.yaml` and `fly.toml` in this repository cover the supported paths. Static or
serverless hosts (Vercel, Netlify, GitHub Pages, S3) cannot serve this build as-is: there is no HTML for
them to serve, so the platform answers with its own 404, and a read-only ephemeral filesystem cannot hold
accounts, sessions or media. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### If an administrator password is lost

There is no "forgot password" link. OGCTV ships no mail transport, and a reset link handed over any
other channel (SMS, WhatsApp, a helpdesk ticket) is weaker than the credential it replaces. Recovery is
therefore an attended, server-side operation:

```bash
cd /srv/ogctv                                          # the deployment's working copy
npm run db:recover-password -- --email editor@newsroom.example
```

The tool prints the absolute database path it will write to, asks for the new passphrase twice with the
input masked, requires typing `RESET`, then replaces the `scrypt` hash and deletes every session that
account holds — so a copied cookie dies with the old password. The passphrase is never a command-line
argument, so it cannot land in shell history, `ps` output, a log or a ticket, and the tool refuses to run
when its input is a pipe rather than a terminal. Staff who still know their password change it themselves
at `/admin/account`, which signs out their other devices too.

A self-service reset would require all of the following, and none of it is present today:

1. A transactional mail sender (SES, Postmark, Resend or SMTP) with a dedicated sender domain and SPF, DKIM and DMARC configured.
2. A `password_resets` table holding a 256-bit token's SHA-256 hash, single-use, expiring in 30 minutes or less, bound to one account and cleared when the password changes.
3. Rate limits per account and per address, a response that is byte-identical whether or not the address exists, and no token ever written to a log.
4. The link sent only to the address already on file, a revoke-all-sessions action on use, and a notification to the account holder.
5. The reset path excluded from reverse-proxy access logs, since query strings are logged by default.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for storage, auth, media, migration boundaries and the production checklist.

## Content integrity

Seed stories and SVG illustrations are visibly marked **Sample** and explicitly state that they do not report current events. While published samples remain, public pages emit `noindex` and sample records are excluded from RSS and news-sitemap feeds. No fake livestream is shown. Archive all sample items from the admin overview before publishing verified newsroom content.

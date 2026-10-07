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
npm run seed      # delete local runtime data; next start reseeds it
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

The official OGCTV logo lives at `public/brand/ogctv-official-logo.jpg` and is referenced from
`SITE.logo` in `src/lib/config.ts`. It is the approved master artwork, stored byte-for-byte as
supplied: nothing resizes, crops, recolours or re-encodes it, and the build never regenerates it.
Header, mobile header, footer, favicon, Open Graph metadata and the newsroom CMS all point at that
single file. See [docs/BRANDING.md](docs/BRANDING.md) for the checksum, every integration point,
and the rendering rules.

## Configuration and deployment

- Node 20+ is required.
- Set `NODE_ENV=production` so the session cookie is Secure.
- Put the application behind HTTPS.
- Set `PUBLIC_SITE_URL` to the confirmed production origin (for example, `https://news.example`) for canonical URLs, social metadata, RSS and sitemap output. No unconfirmed OGCTV domain is assumed.
- The only confirmed contact shipped is WhatsApp `0806 253 2830`; no email, address or social account is invented.
- No paid service is required. YouTube/Vimeo and a real livestream are optional future connections.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for storage, auth, media, migration boundaries and the production checklist.

## Content integrity

Seed stories and SVG illustrations are visibly marked **Sample** and explicitly state that they do not report current events. While published samples remain, public pages emit `noindex` and sample records are excluded from RSS and news-sitemap feeds. No fake livestream is shown. Archive all sample items from the admin overview before publishing verified newsroom content.

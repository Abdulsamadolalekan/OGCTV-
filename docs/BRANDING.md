# OGCTV brand asset

## The master

| Field | Value |
| --- | --- |
| Path | `public/brand/ogctv-official-logo.jpg` |
| SHA-256 | `8b863b1fa9786451eafe51b2826c3a00d85ef7cbe994c14781485ca07d78720e` |
| Bytes | `621799` |
| Format | JPEG (JFIF 1.01, baseline, RGB, ICC profile embedded) |
| Dimensions | `1944 × 1920` (aspect ratio `1.01250`) |

This is the newsroom's approved artwork, stored **byte-for-byte as supplied**. Nothing in the
repository ever writes to it: it is not resized, cropped, recoloured, flattened or re-encoded by
the build, and `tests/brand.test.ts` pins its checksum and size so an accidental change fails CI.
`SITE.logoMaster` points here and it is what the article JSON-LD advertises as `publisher.logo`.

## What the site actually renders

`SITE.logo` is a derived file, produced by `node scripts/build-brand-assets.mjs` and committed
(not generated at build time), using only two operations:

| Derived file | Size | How it was made |
| --- | --- | --- |
| `public/brand/ogctv-official-logo-trimmed.png` | 648×631, 74 KB | master minus rows 0–26, scaled by exactly 1/3, lossless PNG |
| `public/icons/favicon-32.png` / `favicon-48.png` | 32, 48 | contained on white, no crop |
| `public/icons/apple-touch-icon-180.png` | 180 | contained on white, no crop |
| `public/brand/og-default.jpg` | 1200×630, 44 KB | contained on a white card with a 90px margin, for link previews |

Why a derivation rather than the master: the supplied file carries a **solid black band in rows
0–26** (an export artifact that reads as a stray rule above the mark) and **27.1% empty white
canvas below the artwork**. Displaying the master directly put a dark line over the logo and forced
the masthead to be 1.37× taller than the mark it contains.

The scale factor is chosen so the aspect ratio is *exactly* preserved: 1944 and 1893 are both
divisible by 3, so `648/631 === 1944/1893` with no rounding. The generator refuses to run if that
stops being true. No crop touches the artwork itself — only the empty band above it — and the PNG
output adds no further generation loss.

Re-derive after replacing the master:

```bash
node scripts/build-brand-assets.mjs
```

## Where it is used

| Surface | File | Notes |
| --- | --- | --- |
| Desktop header | `src/components/Header.astro` | `<img class="brand-logo">`, replaces the old text `.brand-mark` |
| Mobile header | same element | sized only by the `900px` / `640px` queries in `src/styles/global.css` |
| Footer | `src/components/Footer.astro` | on a white plate; the mark's own ground is opaque white |
| Favicon + site icons | `src/layouts/SiteLayout.astro` | 32px, 48px and 180px apple-touch |
| Open Graph / Twitter | `src/layouts/SiteLayout.astro` | `og-default.jpg` is the default `og:image`, with `og:image:alt`, `:width`, `:height`, `:secure_url` and `twitter:image`; a story's lead image still wins |
| Structured data | `src/pages/article/[slug].astro` | `publisher.logo` on the `NewsMediaOrganization` node, using the full-resolution master |
| Admin sidebar, sign-in, setup | `src/layouts/AdminLayout.astro`, `src/pages/admin/login.astro`, `src/pages/admin/setup.astro` | replaces the text "OGCTV NEWSROOM" lockups |
| Admin favicon | `src/layouts/AdminLayout.astro` | 48px icon + apple-touch |

Single source of truth for every path and size: `SITE.logo`, `SITE.logoWidth/Height`,
`SITE.logoMaster`, `SITE.logoSocial`, `SITE.logoIcons` and `SITE.logoBottomBand` in
`src/lib/config.ts`.

## Rendering rules

Height-driven with `width:auto`, `object-fit:contain` and an explicit `aspect-ratio:648/631`, so
the mark's ratio is always honoured. Never set both axes and never use `object-fit:cover` on the
logo — either would distort or crop it. `tests/brand.test.ts` enforces that no stylesheet uses
`cover` or the master's raw canvas numbers.

`SITE.logoBottomBand` (`0.271`) is the empty canvas below the artwork as a fraction of the mark's
height. It is used in CSS to keep the mark optically centred — as `margin-bottom:
calc(var(--logo-h) * -0.271)` in the masthead and as the plate's top padding in the footer and
newsroom — without altering the asset. Update it if the master's framing changes.

## Verified against the design it replaced

Rendered in headless Chromium at 1440×900 and 390×844, measuring the masthead pixels:

| Viewport | mark ink height | vertical offset from bar centre |
| --- | --- | --- |
| desktop, old text wordmark | 38px | −11.5px |
| desktop, official logo | 38px | −3.5px |
| mobile, old text wordmark | 26px | −11.0px |
| mobile, official logo | 24–25px | −5.5px |

`.masthead-main` grew from `112px` to `124px` (`96px` / `92px` on small screens) so the image box
has the same breathing room the text mark had and cannot reach the navigation rule.

## Surfaces reviewed and intentionally left as text

These show the string "OGCTV" but are not logo placeholders:

- `video-poster-empty` / `video-thumb-empty` in `src/pages/index.astro` and `src/pages/tv/index.astro`
  — fallbacks for missing *video artwork*, not for the brand mark.
- `<news:name>` in `src/pages/news-sitemap.xml.ts` and `publisher.name` in article JSON-LD —
  Google News and schema.org require a text name.
- Empty-state copy ("OGCTV newsroom") and navigation labels ("OGCTV TV", "About OGCTV").

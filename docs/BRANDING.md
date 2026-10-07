# OGCTV brand asset

## The official logo

| Field | Value |
| --- | --- |
| Path | `public/brand/ogctv-official-logo.jpg` |
| SHA-256 | `8b863b1fa9786451eafe51b2826c3a00d85ef7cbe994c14781485ca07d78720e` |
| Bytes | `621799` |
| Format | JPEG (JFIF 1.01, baseline, RGB, ICC profile embedded) |
| Dimensions | `1944 × 1920` (aspect ratio `1.0125`) |

The file is the approved master artwork, stored **byte-for-byte as supplied**. It is never
resized, cropped, recoloured, flattened, re-encoded, or redrawn by the build. Every surface
below references this one file, so there is exactly one source of truth for the mark.

Do not add generated or hand-drawn logo variants. If the mark needs to change, the new master
is committed to this same path and the checksum above is updated.

## Where it is used

| Surface | File | Notes |
| --- | --- | --- |
| Desktop header | `src/components/Header.astro` | `<img class="brand-logo">` in place of the old text `.brand-mark` |
| Mobile header | same element | resized only by `@media(max-width:900px)` / `(max-width:640px)` rules in `src/styles/global.css` |
| Footer | `src/components/Footer.astro` | sits on a white plate because the master has a solid white ground |
| Favicon + site icon | `src/layouts/SiteLayout.astro` | `rel="icon"` and `rel="apple-touch-icon"` both point at the master |
| Open Graph / Twitter | `src/layouts/SiteLayout.astro` | the master is the default `og:image`, `og:image:alt`, `og:image:width`/`:height` and `twitter:image` when a story has no lead image |
| Structured data | `src/pages/article/[slug].astro` | `publisher.logo` on the `NewsMediaOrganization` JSON-LD node |
| Admin sidebar | `src/layouts/AdminLayout.astro` | replaces the text "OGCTV NEWSROOM" lockup, keeps the `NEWSROOM` label |
| Admin favicon | `src/layouts/AdminLayout.astro` | points at the master |
| Sign-in card | `src/pages/admin/login.astro` | replaces the text logo |
| First-run setup card | `src/pages/admin/setup.astro` | replaces the text logo |

Single source of truth for the path: `SITE.logo` and `SITE.logoSize` in `src/lib/config.ts`.

## Rendering rules

`height` is set and `width:auto`, with `object-fit:contain`, so the master's own ratio is always
honoured. Never set both axes, and never use `object-fit:cover` on this asset — both would either
distort or crop the mark.

## Layout accommodations (CSS only, never the asset)

The master's canvas is mostly empty: the artwork occupies rows 27–1406 of 1920, so a naive
`height`-driven render pushed the newsroom tagline ~25px away from the mark and left the lockup
high in the masthead. Two layout-only adjustments fix that while the file stays byte-exact:

- `.masthead-main` height: `112px` → `124px` desktop, `85px` → `96px` / `92px` on small screens.
  The logo box is taller than the old text mark, so the bar grew to keep breathing room and to stop
  the image's opaque white ground from reaching the navigation rule.
- `margin-bottom: calc(var(--logo-h) * -0.2673)` on the header mark, and
  `padding: calc(var(--logo-h) * 0.2673) <side> 0` on the footer and admin plates. `0.2673` is
  exactly the 513/1920 empty band below the artwork. The plates use padding rather than a negative
  margin because a negative margin let the image's white canvas paint past the plate edge (visible
  notch on dark backgrounds).

Verified against the previous design by pixel measurement of the rendered masthead:

| Viewport | mark ink height | vertical offset from bar centre |
| --- | --- | --- |
| desktop (old text mark) | 38px | −11.5px |
| desktop (official logo) | 38px | −3.5px |
| mobile (old text mark) | 26px | −11.0px |
| mobile (official logo) | 24–25px | −5.5px |

The rendered mark therefore keeps the same visual weight as the wordmark it replaced, and now sits
near-optimically centred instead of biased high.

## Known properties of the master file

Measured from the asset itself, not inferred:

1. Rows `0–26` are a solid black band (1.41 % of canvas height). Screen-shot review found this is
   **visible**, not negligible: it reads as a stray dark rule floating above the mark, most obviously
   where the logo sits on a white plate (footer, newsroom sidebar). It is left in place because
   removing it means trimming the official asset. See "Open item" below.
2. The artwork itself spans rows `27–1406` and the full canvas width; the bottom `513` px
   (26.7 % of height) is empty white.
3. The visible "OGCTV + TV screen" lockup occupies 38.2 % of canvas height.
4. The background is pure white `(255,255,255)`; the masthead ground is `--paper:#fbfaf6`. The
   delta is ~4 levels and reads as seamless, but it is not a transparent asset.

These are properties of the supplied master. They are deliberately **not** corrected in the
repository copy, because trimming or flattening would alter the official asset. If a trimmed and
transparently backed master is ever supplied, replace the file at this path and nothing else needs
to change — every surface reads from `SITE.logo`.

## Open item: the black band

The band could be removed with a single CSS change (`object-position` plus a clip, or a trimmed
copy of the master), but both options alter how the official artwork is presented, so neither was
applied unilateratedly. Decision belongs to the newsroom:

- **Preferred** — supply the master re-exported without the 27 px band (and ideally on a transparent
  ground). Drop it on this path, and the plates in the footer and newsroom stop being necessary.
- **Acceptable** — authorise a trimmed copy at a second path and point `SITE.logo` at it, keeping
  this byte-exact master in the repo as the archival original.

## Favicon note

`rel="icon"` and `rel="apple-touch-icon"` deliberately reference the 1944x1920 master rather than a
resampled icon, so no derived artwork exists anywhere in the project. The cost is that the icon
response is 621 KB (cached once per origin) and the mark is small at 16 px. A dedicated 32 px and
180 px export would be better; that is a proportional downscale of this same file, so it needs the
newsroom's approval before it is generated.

## Surfaces reviewed and intentionally left as text

These show the string "OGCTV" but are not logo placeholders, so they were left alone:

- `video-poster-empty` / `video-thumb-empty` in `src/pages/index.astro` and `src/pages/tv/index.astro`
  — fallbacks for missing *video artwork*, not for the brand mark.
- `src/pages/news-sitemap.xml.ts` `<news:name>` and the `publisher.name` field in article JSON-LD —
  Google News and schema.org require a text name here.
- Empty-state copy such as "OGCTV newsroom" on `src/pages/index.astro`, and navigation labels
  ("OGCTV TV", "About OGCTV").

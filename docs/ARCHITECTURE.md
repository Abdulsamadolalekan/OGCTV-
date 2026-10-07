# OGCTV architecture

## Runtime

OGCTV uses Astro's standalone Node adapter in server-rendered mode. Public pages are rendered from the content database on each request, so publication does not require a rebuild. Static assets are cached. The application is deployable anywhere a Node 22.12+ process and persistent disk are available.

## Content storage

`data/ogctv.db` is a SQLite database in WAL mode. It contains articles, categories, authors, users, sessions, media metadata, and an FTS5 full-text index. Uploaded media files live in `data/media/`. Both paths are intentionally ignored by Git and **must be put on persistent storage and backed up in production**.

The typed access boundary is `src/lib/queries.ts`. To migrate to PostgreSQL later, reproduce those exported operations in a PostgreSQL adapter; pages and components do not contain SQL.

## Authentication

There are no default or hard-coded credentials. On an empty installation, `/admin/setup` creates the only initial administrator. Passwords use Node's scrypt with a random 128-bit salt. Session identifiers are random 256-bit tokens; only their SHA-256 hashes are stored. Cookies are HTTP-only, SameSite=Lax, Secure in production, and expire after 12 hours. Admin mutations receive same-origin checks and login attempts are throttled in memory. Staff change their own password in `/admin/account`; the change verifies the current password and destroys every session for that account first. A lost password is recovered by running `npm run db:recover-password` on the server that holds the database — there is no emailed reset link, because there is no mail transport and a link handed over another channel would be weaker than the credential it replaces. The `/admin` surface sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` on rendered pages and on redirects alike.

For a horizontally scaled deployment, move sessions and rate-limit counters to a shared store (PostgreSQL/Redis) and add optional MFA. Place the site behind TLS and a reverse proxy with request-size/rate controls.

## Media

Uploads are decoded and re-encoded by Sharp, EXIF-rotated, restricted by MIME type and size, and resized to a 2000px maximum width. The current route serves local media with immutable caching. A future object-storage adapter can replace `src/lib/media.ts` without changing article records, which store media URLs.

## Video

Article records accept video URLs and programme identifiers. YouTube uses the privacy-enhanced `youtube-nocookie.com` player; Vimeo is supported. Unsupported or absent video links produce an honest availability state. A real livestream should be connected only through `SITE.liveStreamUrl`; there is no simulated live feed.

## Seed content

Demonstration records have `is_sample = 1`, carry a visible warning, and contain no claims about current events. The admin overview can archive all samples in one action. Illustrations are explicitly marked sample and are not documentary images.

## Deployment checklist

1. Set `PUBLIC_SITE_URL` to the confirmed canonical production origin.
2. Provide persistent storage for `OGCTV_DATA_DIR` (defaults to `./data`).
3. Run behind HTTPS; set `NODE_ENV=production`.
4. Complete `/admin/setup` once with a strong, unique password.
5. Back up the SQLite file and media directory regularly.
6. Archive sample content and publish verified reporting.
7. Connect only verified video channels/stream URLs.
8. Add shared session storage and MFA before multiple-server scaling.
9. Keep `data/` off network filesystems: WAL mode needs real file locking, and one database file must be served by one Node process.

import { defineMiddleware } from 'astro:middleware'
import { getSessionUser, userCount } from './lib/auth'
import { SITE } from './lib/config'
import { ensureSeeded } from './lib/seed'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
  "connect-src 'self'",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/**
 * The newsroom is never a framing target — not by a third party and not by the
 * public site either. `frame-ancestors` is the modern directive; X-Frame-Options
 * is kept for engines that ignore CSP. The public CSP is untouched so embedded
 * YouTube/Vimeo players (and the admin preview that hosts one) keep working:
 * `frame-ancestors` restricts who may frame *this* page, `frame-src` restricts
 * what this page may frame.
 */
const ADMIN_CSP = `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`

function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

/**
 * Apply the hardening headers to any response, including the redirects this
 * middleware issues. Redirect responses used to skip them entirely, which left
 * a cacheable `/admin` hop with no `no-store` and no `X-Robots-Tag`.
 */
function secure(response: Response, admin: boolean, protocol: string): Response {
  const headers = response.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Content-Security-Policy', admin ? ADMIN_CSP : CONTENT_SECURITY_POLICY)
  if (admin) {
    headers.set('X-Robots-Tag', 'noindex, nofollow')
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Frame-Options', 'DENY')
  }
  if (protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return response
}

export const onRequest = defineMiddleware(async (context, next) => {
  ensureSeeded()
  const path = context.url.pathname
  const admin = isAdminPath(path)

  // Browsers ask for /favicon.ico unprompted and before they read the document.
  // The mark ships as PNG (see docs/BRANDING.md), so answer the legacy probe with
  // a redirect instead of committing a duplicate icon in a second format.
  if (path === '/favicon.ico') {
    const response = new Response(null, {
      status: 301,
      headers: { location: SITE.logoIcons.favicon48 },
    })
    response.headers.set('Cache-Control', 'public, max-age=604800')
    return secure(response, false, context.url.protocol)
  }

  if (admin) {
    const open = path === '/admin/login' || path === '/admin/setup'
    const hasUsers = userCount() > 0

    if (!hasUsers && path !== '/admin/setup') {
      return secure(context.redirect('/admin/setup', 303), true, context.url.protocol)
    }
    if (hasUsers && path === '/admin/setup') {
      return secure(context.redirect('/admin/login', 303), true, context.url.protocol)
    }
    if (!open) {
      const user = getSessionUser(context.request, context.cookies)
      if (!user) {
        const nextPath = encodeURIComponent(`${path}${context.url.search}`)
        return secure(
          context.redirect(`/admin/login?next=${nextPath}`, 303),
          true,
          context.url.protocol,
        )
      }
      context.locals.user = user
    }
  }

  return secure(await next(), admin, context.url.protocol)
})

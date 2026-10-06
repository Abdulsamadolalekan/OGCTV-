import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, userCount } from './lib/auth';
import { ensureSeeded } from './lib/seed';

export const onRequest = defineMiddleware(async (context, next) => {
  ensureSeeded();
  const path = context.url.pathname;

  if (path.startsWith('/admin')) {
    const open = path === '/admin/login' || path === '/admin/setup';
    const hasUsers = userCount() > 0;

    if (!hasUsers && path !== '/admin/setup') {
      return context.redirect('/admin/setup', 303);
    }
    if (hasUsers && path === '/admin/setup') {
      return context.redirect('/admin/login', 303);
    }
    if (!open) {
      const user = getSessionUser(context.request, context.cookies);
      if (!user) {
        const nextPath = encodeURIComponent(`${path}${context.url.search}`);
        return context.redirect(`/admin/login?next=${nextPath}`, 303);
      }
      context.locals.user = user;
    }
  }

  const response = await next();
  if (path.startsWith('/admin')) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return response;
});

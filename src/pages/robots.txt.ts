import type { APIRoute } from 'astro'; import {SITE} from '../lib/config';
export const prerender=true;
export const GET:APIRoute=()=>new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${SITE.url}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});

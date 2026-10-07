// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// OGCTV — Ogun's digital voice.
//
// Rendering strategy:
// - The public newsroom renders on the server (default `output: 'server'`)
//   so newly published or breaking stories appear the moment an editor
//   hits "Publish" — no rebuild required.
// - Genuinely static pages (legal, about, contact, robots) are prerendered.
// - The server runs anywhere Node runs via the standalone Node adapter.
export default defineConfig({
  // Canonical origin. PUBLIC_SITE_URL is the one you set; RENDER_EXTERNAL_URL is provided by
  // Render's blueprint, so a Render deploy gets correct canonical/OG/sitemap URLs even when the
  // dashboard prompt is skipped. localhost only applies to local development.
  site: process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4321',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: {
    host: true,
    port: Number(process.env.PORT) || 4321,
  },
  vite: {
    // Arena and reverse-proxy deployments use dynamic preview hostnames.
    server: { allowedHosts: true },
    // Sharp is used at runtime for media processing; keep it external to the bundle.
    ssr: {
      external: ['sharp', 'better-sqlite3'],
    },
  },
});

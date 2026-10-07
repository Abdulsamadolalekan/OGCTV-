/**
 * OGCTV site configuration.
 *
 * Everything a newsroom editor might change lives here or in the admin CMS.
 * No secrets belong in this file — runtime secrets come from environment
 * variables (see README.md → "Configuration").
 */

export const SITE = {
  name: 'OGCTV',
  tagline: "Ogun's digital voice.",
  /**
   * The mark every surface renders. Derived from LOGO_MASTER by
   * `node scripts/build-brand-assets.mjs`: the black export band is dropped
   * and the artwork is scaled by exactly 1/3 as lossless PNG, so its aspect
   * ratio is unchanged and nothing is cropped, stretched or recoloured.
   * It is committed, not generated at build time.
   */
  logo: '/brand/ogctv-official-logo-trimmed.png',
  /** Natural pixel size of the rendered mark — locks aspect ratio in markup. */
  logoWidth: 648,
  logoHeight: 631,
  /**
   * The approved master artwork as supplied by the newsroom, kept byte-for-byte
   * and never written to by the generator. Source of truth for any re-derivation.
   */
  logoMaster: '/brand/ogctv-official-logo.jpg',
  /** Share-card image (1.91:1) so link previews are never cropped by the platform. */
  logoSocial: '/brand/og-default.jpg',
  logoSocialWidth: 1200,
  logoSocialHeight: 630,
  /** Site icons, contained on white from the same derivation. */
  logoIcons: {
    favicon32: '/icons/favicon-32.png',
    favicon48: '/icons/favicon-48.png',
    appleTouch180: '/icons/apple-touch-icon-180.png',
  },
  /**
   * Empty canvas below the artwork, as a fraction of the rendered mark's height
   * (rows 460-631 of 631). Used in CSS to optically centre the mark without
   * touching the asset. Regenerate if the master changes.
   */
  logoBottomBand: 0.271,
  description:
    'OGCTV is a Nigerian digital media platform reporting on Ogun State and surrounding communities — breaking news, politics, business, education, community stories and original video.',
  /**
   * Canonical origin. `PUBLIC_SITE_URL` is the variable to set; `RENDER_EXTERNAL_URL` is
   * provided automatically by Render's blueprint, so canonical/OG/sitemap URLs are correct
   * there even if the dashboard prompt is skipped. localhost applies to local development only.
   */
  url: process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4321',
  locale: 'en-NG',
  /** Timezone used for all displayed timestamps. */
  timezone: 'Africa/Lagos',
  /** Public WhatsApp line (newsroom contact + tips). */
  whatsapp: '0806 253 2830',
  /** Digits-only form, for wa.me links (international format, no +). */
  whatsappIntl: '2348062532830',
  /**
   * Live video stream URL. Set to a REAL stream/embed URL only when OGCTV
   * has one — the TV page never fakes a live stream. null = no live block.
   */
  liveStreamUrl: null as string | null,
  /**
   * When true, the deployment still runs on demonstration content seeded
   * by the newsroom-admin. Sample stories are tagged "Sample" across the
   * site and can be archived/deleted from the admin in one action.
   */
  demoContent: true,
} as const

export const NAV_SECTIONS = [
  { label: 'Latest', href: '/latest' },
  { label: 'Breaking', href: '/breaking' },
  { label: 'TV', href: '/tv' },
] as const

/** Primary navigation categories (slug must exist in the `categories` table). */
export const NAV_CATEGORIES = [
  'ogun',
  'politics',
  'government',
  'business',
  'education',
  'crime',
  'community',
  'sports',
  'entertainment',
] as const

export const FOOTER_SECTIONS = [
  {
    title: 'News',
    links: [
      { label: 'Latest', href: '/latest' },
      { label: 'Breaking news', href: '/breaking' },
      { label: 'Ogun State', href: '/category/ogun' },
      { label: 'Politics', href: '/category/politics' },
      { label: 'Business', href: '/category/business' },
      { label: 'Education', href: '/category/education' },
      { label: 'Crime & security', href: '/category/crime' },
      { label: 'Community', href: '/category/community' },
    ],
  },
  {
    title: 'OGCTV TV',
    links: [
      { label: 'Watch OGCTV', href: '/tv' },
      { label: 'OGCTV Reports', href: '/tv?programme=ogctv-reports' },
      { label: 'Interviews', href: '/tv?programme=ogctv-interviews' },
      { label: 'Gateway This Week', href: '/tv?programme=gateway-this-week' },
      { label: 'News clips', href: '/tv?programme=news-clips' },
    ],
  },
  {
    title: 'Newsroom',
    links: [
      { label: 'About OGCTV', href: '/about' },
      { label: 'Editorial principles', href: '/editorial-principles' },
      { label: 'Contact & tips', href: '/contact' },
      { label: 'Corrections', href: '/corrections' },
      { label: 'Submit a story', href: '/contact#tip' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
      { label: 'RSS feed', href: '/rss.xml' },
      { label: 'Sitemap', href: '/sitemap.xml' },
    ],
  },
] as const

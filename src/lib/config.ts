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
  description:
    'OGCTV is a Nigerian digital media platform reporting on Ogun State and surrounding communities — breaking news, politics, business, education, community stories and original video.',
  /** Canonical origin. Change when deploying to a real domain. */
  url: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',
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

/** Secondary navigation (under "More"). */
export const NAV_MORE = [
  { slug: 'interviews', label: 'Interviews' },
  { slug: 'features', label: 'Features' },
  { slug: 'opinion', label: 'Opinion' },
  { slug: 'announcements', label: 'Announcements' },
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

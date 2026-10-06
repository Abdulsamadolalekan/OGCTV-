export const SEED_VERSION = 1;

export const seedCategories = [
  { slug: 'ogun', name: 'Ogun', description: 'News and reporting from across Ogun State.', position: 1 },
  { slug: 'politics', name: 'Politics', description: 'Elections, parties, policy and public accountability.', position: 2 },
  { slug: 'government', name: 'Government', description: 'Public affairs, services and institutions.', position: 3 },
  { slug: 'business', name: 'Business', description: 'Enterprise, markets, jobs and the local economy.', position: 4 },
  { slug: 'education', name: 'Education', description: 'Schools, campuses, learning and young people.', position: 5 },
  { slug: 'crime', name: 'Crime', description: 'Public safety, justice and verified security reporting.', position: 6 },
  { slug: 'community', name: 'Community', description: 'People, places and everyday life across Ogun.', position: 7 },
  { slug: 'entertainment', name: 'Entertainment', description: 'Culture, film, music and creative life.', position: 8 },
  { slug: 'sports', name: 'Sports', description: 'Grassroots and professional sport.', position: 9 },
  { slug: 'interviews', name: 'Interviews', description: 'Conversations with newsmakers and community voices.', position: 10 },
  { slug: 'features', name: 'Features', description: 'Long reads, investigations and visual reporting.', position: 11 },
  { slug: 'opinion', name: 'Opinion', description: 'Analysis and clearly labelled commentary.', position: 12 },
  { slug: 'announcements', name: 'Announcements', description: 'Verified public notices and newsroom announcements.', position: 13 },
];

export const seedAuthors = [
  { slug: 'ogctv-newsroom', name: 'OGCTV Newsroom', role_title: 'News desk', bio: 'The OGCTV newsroom reports on Ogun State and surrounding communities.' },
  { slug: 'ogctv-business-desk', name: 'OGCTV Business Desk', role_title: 'Business desk', bio: 'Enterprise, markets and economic life across Ogun State.' },
  { slug: 'ogctv-sports-desk', name: 'OGCTV Sports Desk', role_title: 'Sports desk', bio: 'Grassroots and professional sports coverage from the OGCTV newsroom.' },
  { slug: 'ogctv-video', name: 'OGCTV Video', role_title: 'Video desk', bio: 'Original interviews, field reports and news clips from OGCTV.' },
];

const body = (topic: string) => `This is demonstration copy showing how an OGCTV report about **${topic}** will read. It is not a current news claim and should be replaced by verified newsroom reporting before launch.

OGCTV articles are designed to put the most important verified information first, followed by context that helps readers understand why the story matters in their community.

## What readers should know

A finished report would clearly identify the source of every material claim, distinguish confirmed facts from allegations, and include responses from people or institutions named in the story. Dates, places and public-service information should be checked before publication.

The newsroom can add photographs, documents, video and links where they improve understanding. Corrections are noted transparently. Readers can contact OGCTV on WhatsApp with relevant evidence or a correction request.

## Local context

Good local journalism connects decisions to daily life. OGCTV's reporting workflow is built for follow-up coverage, related stories and updates without losing the original publication record.

*Sample newsroom content — not a report of a real event.*`;

const t = (hours: number) => new Date(Date.UTC(2026, 9, 6, 20 - hours, 0, 0)).toISOString();

export const seedArticles = [
  { slug: 'inside-ogun-neighbourhood-markets', kind: 'story', title: 'Inside the neighbourhood markets powering Ogun’s everyday economy', deck: 'A model long-read on traders, supply chains and the people behind local commerce.', body: body('neighbourhood markets'), category: 'business', author: 'ogctv-business-desk', status: 'published', featured: true, trending: true, image: '/seed-media/market.svg', imageAlt: 'Editorial illustration of a busy open market', imageCaption: 'Illustration for OGCTV demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Markets','Enterprise','Ogun'], publishedAt: t(1) },
  { slug: 'how-local-councils-shape-daily-services', kind: 'story', title: 'Explainer: How local councils shape the services residents use every day', deck: 'A plain-language guide to responsibilities, public records and citizen participation.', body: body('local government services'), category: 'government', author: 'ogctv-newsroom', status: 'published', trending: true, image: '/seed-media/civic.svg', imageAlt: 'Editorial illustration of a civic building', imageCaption: 'Illustration for demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Explainer','Public services'], publishedAt: t(2) },
  { slug: 'community-reporting-verification-guide', kind: 'story', title: 'What OGCTV checks before publishing a community report', deck: 'Our verification checklist for tips, images, eyewitness accounts and public notices.', body: body('verification in community reporting'), category: 'community', author: 'ogctv-newsroom', status: 'published', image: '/seed-media/community.svg', imageAlt: 'Editorial illustration of people meeting in a community square', imageCaption: 'Illustration for demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Newsroom','Verification'], publishedAt: t(3) },
  { slug: 'students-building-solutions-campus', kind: 'story', title: 'The student builders turning classroom ideas into practical solutions', deck: 'A sample feature format for profiles from schools and campuses across Ogun.', body: body('student innovation'), category: 'education', author: 'ogctv-newsroom', status: 'published', image: '/seed-media/education.svg', imageAlt: 'Editorial illustration of students studying together', imageCaption: 'Illustration for demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Students','Innovation'], publishedAt: t(4) },
  { slug: 'reading-public-budget-documents', kind: 'story', title: 'A citizen’s guide to reading public budget documents', deck: 'Where to begin, which figures matter and the questions reporters ask.', body: body('public budget documents'), category: 'politics', author: 'ogctv-newsroom', status: 'published', trending: true, image: '/seed-media/data.svg', imageAlt: 'Editorial illustration of documents and charts', imageCaption: 'Illustration for demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Accountability','Explainer'], publishedAt: t(5) },
  { slug: 'grassroots-sport-community', kind: 'story', title: 'Why grassroots sport matters beyond the final score', deck: 'A reporting template for clubs, athletes, facilities and youth development.', body: body('grassroots sport'), category: 'sports', author: 'ogctv-sports-desk', status: 'published', trending: true, image: '/seed-media/sport.svg', imageAlt: 'Editorial illustration of football players on a community pitch', imageCaption: 'Illustration for demonstration content.', imageCredit: 'OGCTV illustration', tags: ['Grassroots sport','Youth'], publishedAt: t(6) },
  { slug: 'reporting-public-safety-responsibly', kind: 'story', title: 'How responsible public-safety reporting protects the public', deck: 'Verification, privacy and language choices in developing crime stories.', body: body('responsible public-safety reporting'), category: 'crime', author: 'ogctv-newsroom', status: 'published', image: '/seed-media/civic.svg', imageAlt: 'Editorial illustration symbolising public safety', tags: ['Safety','Newsroom'], publishedAt: t(7) },
  { slug: 'creative-spaces-local-culture', kind: 'story', title: 'The creative spaces giving local culture room to grow', deck: 'A sample culture feature for artists, organisers and audiences.', body: body('local creative culture'), category: 'entertainment', author: 'ogctv-newsroom', status: 'published', image: '/seed-media/community.svg', imageAlt: 'Editorial illustration of a cultural gathering', tags: ['Culture','Arts'], publishedAt: t(8) },
  { slug: 'questions-to-ask-public-office', kind: 'story', title: 'Five useful questions to ask when a public office announces a project', deck: 'An accountability checklist for residents and local reporters.', body: body('public project announcements'), category: 'government', author: 'ogctv-newsroom', status: 'published', image: '/seed-media/data.svg', imageAlt: 'Editorial illustration of a checklist', tags: ['Public affairs','Accountability'], publishedAt: t(9) },
  { slug: 'small-business-digital-tools', kind: 'story', title: 'Practical digital tools for small businesses: what to compare', deck: 'A consumer-minded guide to costs, reliability, privacy and support.', body: body('digital tools for small businesses'), category: 'business', author: 'ogctv-business-desk', status: 'published', tags: ['Small business','Technology'], publishedAt: t(10) },
  { slug: 'reporting-across-ogun', kind: 'story', title: 'Reporting across Ogun: a guide to OGCTV’s community-first approach', deck: 'Why local knowledge, evidence and follow-up reporting belong together.', body: body('community-first journalism'), category: 'features', author: 'ogctv-newsroom', status: 'published', tags: ['OGCTV','Local journalism'], publishedAt: t(11) },
  { slug: 'opinion-standards', kind: 'story', title: 'Opinion at OGCTV: clear labels, evidence and room for disagreement', deck: 'How commentary will remain distinct from the newsroom’s factual reporting.', body: body('responsible opinion publishing'), category: 'opinion', author: 'ogctv-newsroom', status: 'published', tags: ['Opinion','Standards'], publishedAt: t(12) },
  { slug: 'newsroom-open-for-tips', kind: 'story', title: 'OGCTV newsroom is open for verified tips and community stories', deck: 'Send documents, photographs or a clear account through our newsroom WhatsApp line.', body: body('news tips and submissions'), category: 'announcements', author: 'ogctv-newsroom', status: 'published', tags: ['News tips','Contact'], publishedAt: t(13) },
  { slug: 'ogctv-reports-community-journalism', kind: 'video', title: 'OGCTV Reports: What community-first journalism looks like', deck: 'A demonstration video page prepared for future field reporting.', body: body('OGCTV video reporting'), category: 'community', author: 'ogctv-video', status: 'published', featured: true, image: '/seed-media/community.svg', imageAlt: 'Editorial illustration used as a demonstration video thumbnail', videoDuration: '04:18', programme: 'ogctv-reports', tags: ['Video','Reporting'], publishedAt: t(2) },
  { slug: 'interview-preparing-a-good-news-tip', kind: 'video', title: 'Interview desk: Preparing a useful news tip', deck: 'What details help a local newsroom verify and follow up a story.', body: body('preparing a useful news tip'), category: 'interviews', author: 'ogctv-video', status: 'published', image: '/seed-media/civic.svg', imageAlt: 'Demonstration video thumbnail illustration', videoDuration: '07:42', programme: 'ogctv-interviews', tags: ['Video','Interview'], publishedAt: t(6) },
  { slug: 'gateway-this-week-format-preview', kind: 'video', title: 'Gateway This Week: Programme format preview', deck: 'A demonstration of OGCTV’s planned weekly news review experience.', body: body('a weekly news review programme'), category: 'ogun', author: 'ogctv-video', status: 'published', image: '/seed-media/data.svg', imageAlt: 'Demonstration weekly programme thumbnail', videoDuration: '02:30', programme: 'gateway-this-week', tags: ['Video','Programme'], publishedAt: t(10) },
  { slug: 'community-diaries-format-preview', kind: 'video', title: 'Community Diaries: Programme format preview', deck: 'A home for people-led stories from towns and neighbourhoods.', body: body('community video stories'), category: 'community', author: 'ogctv-video', status: 'published', image: '/seed-media/market.svg', imageAlt: 'Demonstration community video thumbnail', videoDuration: '03:06', programme: 'community-diaries', tags: ['Video','Community'], publishedAt: t(14) },
  { slug: 'draft-first-real-story', kind: 'story', title: 'Replace this draft with the newsroom’s first report', deck: 'A safe draft is ready for editors to update.', body: 'This draft is visible only in the protected newsroom.', category: 'ogun', author: 'ogctv-newsroom', status: 'draft', tags: ['Draft'], publishedAt: t(1) },
] as const;

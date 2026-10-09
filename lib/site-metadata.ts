export const SITE_NAME = 'Cursed Concepts'

export const SITE_DESCRIPTION = 'Create, share, and browse fan-made Deadlock hero concepts.'

export const SITE_KEYWORDS: string[] = [
  'Deadlock',
  'hero concepts',
  'custom heroes',
  'fan-made',
  'hero creator',
]

/** Shared root openGraph defaults. Spread by app/layout.tsx and option (b) pages (spec 22). */
export const SHARED_OPEN_GRAPH = {
  type: 'website',
  siteName: SITE_NAME,
  locale: 'en_US',
} as const

/** Shared root twitter defaults. Spread by app/layout.tsx and option (b) pages (spec 22). */
export const SHARED_TWITTER = {
  card: 'summary_large_image',
} as const

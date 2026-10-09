export const SITE_URL_FALLBACK = 'https://cursedconcepts.xyz'

/**
 * Canonical public origin for SEO (metadataBase, robots, sitemap, JSON-LD).
 * Reads NEXT_PUBLIC_SITE_URL at call time, trims it, parses it with `new URL`,
 * and accepts only http: and https:. Returns `url.origin` (no trailing slash,
 * no path). Otherwise returns SITE_URL_FALLBACK. Never throws.
 */
export function getSiteUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (!rawValue) {
    return SITE_URL_FALLBACK
  }

  try {
    const url = new URL(rawValue)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return SITE_URL_FALLBACK
    }

    return url.origin
  } catch {
    return SITE_URL_FALLBACK
  }
}

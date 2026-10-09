import type { MetadataRoute } from 'next'

import { listPublicHeroSitemapEntries, listPublicProfileSitemapEntries } from '@/lib/public-pages'
import type { PublicSitemapEntry } from '@/lib/public-page-types'
import { getSiteUrl } from '@/lib/site-url'

// Rendered per request so `next build` never connects to the database and
// entries stay fresh. Crawlers fetch the sitemap rarely.
export const dynamic = 'force-dynamic'

// Well under the 50,000-URL-per-sitemap limit. When either cap is reached,
// split the sitemap with `generateSitemaps`
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-sitemaps.md).
export const SITEMAP_HERO_LIMIT = 5000
export const SITEMAP_PROFILE_LIMIT = 5000

// Only indexable, canonical URLs belong here. Never set `lastModified: new Date()`;
// use real data (e.g. a document's `updatedAt`) when a producer has it.
export function getStaticSitemapEntries(): MetadataRoute.Sitemap {
  return [{ url: getSiteUrl(), changeFrequency: 'weekly', priority: 1 }]
}

function toSitemapEntries(entries: PublicSitemapEntry[], priority: number): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()

  return entries.map(entry => ({
    url: `${siteUrl}${entry.path}`,
    lastModified: entry.lastModified,
    changeFrequency: 'weekly',
    priority,
  }))
}

export async function getPublishedHeroSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    return toSitemapEntries(await listPublicHeroSitemapEntries(SITEMAP_HERO_LIMIT), 0.7)
  } catch (error) {
    console.error('Failed to load hero sitemap entries', error)
    return []
  }
}

export async function getPublicProfileSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    return toSitemapEntries(await listPublicProfileSitemapEntries(SITEMAP_PROFILE_LIMIT), 0.5)
  } catch (error) {
    console.error('Failed to load profile sitemap entries', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [heroes, profiles] = await Promise.all([getPublishedHeroSitemapEntries(), getPublicProfileSitemapEntries()])

  return [...getStaticSitemapEntries(), ...heroes, ...profiles]
}

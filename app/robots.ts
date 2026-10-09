import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/sso-callback', '/profile/settings'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}

import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import PublicHeroPage from '@/components/PublicHero/PublicHeroPage'
import { getHeroPath, getPublicHeroForMetadata, getPublicHeroPage, isValidHeroSlug } from '@/lib/public-pages'

// Per-viewer actions and the owner preview make this page request-specific.
// Do not add a loading.tsx under app/characters/: notFound() and permanentRedirect()
// must run before any streaming so they return real 404 and 308 status codes.
export const dynamic = 'force-dynamic'

interface HeroPageProps {
  params: Promise<{ slug: string }>
}

/** Shared by missing, invalid, and non-public heroes so metadata never reveals existence. */
function getHeroFallbackMetadata(): Metadata {
  return {
    title: 'Hero concept',
    robots: { index: false, follow: false },
  }
}

// Session-independent: only the public-only lookup, never auth().
export async function generateMetadata({ params }: HeroPageProps): Promise<Metadata> {
  const { slug } = await params

  if (!isValidHeroSlug(slug)) return getHeroFallbackMetadata()

  let hero

  try {
    hero = await getPublicHeroForMetadata(slug)
  } catch {
    return getHeroFallbackMetadata()
  }

  if (!hero) return getHeroFallbackMetadata()

  return {
    title: `${hero.displayName} (Deadlock hero concept)`,
    description: hero.description,
    alternates: { canonical: hero.canonicalPath },
  }
}

export default async function HeroPage({ params }: HeroPageProps) {
  const { slug } = await params

  if (!isValidHeroSlug(slug)) {
    const lowerSlug = slug.toLowerCase()

    // Viewer-aware: only redirect to a hero this viewer could open anyway.
    if (lowerSlug !== slug && isValidHeroSlug(lowerSlug) && await getPublicHeroPage(lowerSlug)) {
      permanentRedirect(getHeroPath(lowerSlug))
    }

    notFound()
  }

  const data = await getPublicHeroPage(slug)

  if (!data) notFound()

  return <PublicHeroPage data={data} />
}

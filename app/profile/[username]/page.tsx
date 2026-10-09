import type { Metadata } from 'next'

import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import PublicUserProfile from '@/components/UserProfile/PublicUserProfile'
import UserProfile from '@/components/UserProfile/UserProfile'
import { HEROES } from '@/lib/hero-data'
import { serializeJsonLd } from '@/lib/json-ld'
import { getUserProfile, isProfilePrivateError, isProfileUnavailableError, toPublicProfileView } from '@/lib/profile'
import type { PublicProfileSeo } from '@/lib/public-page-types'
import { buildProfileJsonLd, getPublicProfileSeo } from '@/lib/public-pages'
import { SHARED_OPEN_GRAPH, SHARED_TWITTER } from '@/lib/site-metadata'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
}

/** Identical for missing, private, and failed lookups, so metadata never reveals existence. */
function getProfileFallbackMetadata(): Metadata {
  return {
    title: 'Creator profile',
    robots: { index: false, follow: false },
  }
}

async function loadProfileSeo(segment: string): Promise<PublicProfileSeo | null> {
  try {
    return await getPublicProfileSeo(segment)
  } catch {
    return null
  }
}

// Session-independent: getPublicProfileSeo never calls auth() or the Clerk API.
export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const seo = await loadProfileSeo(username)

  if (!seo || seo.status === 'missing' || seo.status === 'private') {
    return getProfileFallbackMetadata()
  }

  if (seo.status === 'noindex') {
    return {
      title: `${seo.username ?? 'Creator'}'s hero concepts`,
      ...(seo.description ? { description: seo.description } : {}),
      robots: { index: false, follow: true },
    }
  }

  return {
    title: `${seo.username}'s hero concepts`,
    ...(seo.description ? { description: seo.description } : {}),
    ...(seo.canonicalPath ? { alternates: { canonical: seo.canonicalPath } } : {}),
    // The single option (b) exception: only with a safe stored avatar. Otherwise the
    // root openGraph/twitter objects and the root share image are inherited.
    ...(seo.ogImageUrl
      ? {
          openGraph: {
            ...SHARED_OPEN_GRAPH,
            images: [{ url: seo.ogImageUrl, alt: `${seo.username} avatar` }],
          },
          twitter: { ...SHARED_TWITTER, card: 'summary' },
        }
      : {}),
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  let data

  try {
    data = await getUserProfile(username)
  } catch (error) {
    if (isProfilePrivateError(error)) {
      return <ProfileUnavailable reason="private" />
    }

    if (isProfileUnavailableError(error)) {
      return <ProfileUnavailable />
    }

    throw error
  }

  const seo = await loadProfileSeo(username)
  const jsonLd = seo?.status === 'indexable'
    ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildProfileJsonLd({ seo, siteUrl: getSiteUrl() })) }} />
    : null

  if (!data.viewerIsOwner) {
    return (
      <>
        <PublicUserProfile data={toPublicProfileView(data)} />
        {jsonLd}
      </>
    )
  }

  return (
    <>
      <UserProfile data={data} heroes={HEROES} />
      {jsonLd}
    </>
  )
}

import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'

import AuthenticatedHome from '@/components/auth/AuthenticatedHome'
import HeroGrid from '@/components/HeroGrid/HeroGrid'
import LandingPage from '@/components/Landing/LandingPage'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
}

interface HomeProps {
  searchParams?: Promise<{
    tab?: string | string[]
    heroId?: string | string[]
  }>
}

function getInitialTab(tab: string | string[] | undefined) {
  const tabValue = Array.isArray(tab) ? tab[0] : tab

  if (tabValue === 'create') {
    return 'Create'
  }

  if (tabValue === 'browse') {
    return 'Browse'
  }

  if (tabValue === 'bookmarks') {
    return 'Bookmarks'
  }

  if (tabValue === 'notifications' || tabValue === 'feed') {
    return 'Notifications'
  }

  return 'Select'
}

export default async function Home({ searchParams }: HomeProps = {}) {
  const { userId } = await auth()
  const resolvedSearchParams = await searchParams
  const initialTab = getInitialTab(resolvedSearchParams?.tab)
  const initialHeroId = Array.isArray(resolvedSearchParams?.heroId) ? resolvedSearchParams?.heroId[0] : resolvedSearchParams?.heroId

  if (!userId) {
    return (
      <AuthenticatedHome
        key={`${initialTab}:${initialHeroId ?? ''}`}
        initialTab={initialTab}
        initialHeroId={initialHeroId}
        guestContent={<LandingPage />}
      />
    )
  }

  return <HeroGrid key={`${initialTab}:${initialHeroId ?? ''}`} initialTab={initialTab} initialHeroId={initialHeroId} />
}

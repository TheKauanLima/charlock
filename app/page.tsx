import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import HeroGrid from '@/components/HeroGrid/HeroGrid'

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

  if (!userId) {
    redirect('/sign-up')
  }

  const resolvedSearchParams = await searchParams
  const initialTab = getInitialTab(resolvedSearchParams?.tab)
  const initialHeroId = Array.isArray(resolvedSearchParams?.heroId) ? resolvedSearchParams?.heroId[0] : resolvedSearchParams?.heroId

  return <HeroGrid key={`${initialTab}:${initialHeroId ?? ''}`} initialTab={initialTab} initialHeroId={initialHeroId} />
}

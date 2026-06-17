import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import HeroGrid from '@/components/HeroGrid/HeroGrid'

interface HomeProps {
  searchParams?: Promise<{
    tab?: string | string[]
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

  if (tabValue === 'bookmarks' || tabValue === 'feed') {
    return 'Bookmarks'
  }

  return 'Select'
}

export default async function Home({ searchParams }: HomeProps = {}) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-up')
  }

  const resolvedSearchParams = await searchParams

  return <HeroGrid initialTab={getInitialTab(resolvedSearchParams?.tab)} />
}

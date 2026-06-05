import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import HeroGrid from '@/components/HeroGrid/HeroGrid'

export default async function Home() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-up')
  }

  return <HeroGrid />
}

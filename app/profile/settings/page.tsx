import { redirect } from 'next/navigation'

import ProfileSettings from '@/components/UserProfile/ProfileSettings'
import { HEROES } from '@/lib/hero-data'
import { getCurrentProfileUser, getProfileDossier, getProfilePathSegment } from '@/lib/profile'

export const dynamic = 'force-dynamic'

interface ProfileSettingsPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const [query, currentUser] = await Promise.all([searchParams, getCurrentProfileUser()])

  if (!currentUser) {
    redirect('/sign-in')
  }

  const data = await getProfileDossier(getProfilePathSegment(currentUser))

  return (
    <ProfileSettings
      user={{
        ...data.user,
        customBio: currentUser.customBio?.trim() ?? '',
      }}
      avatarUrl={data.avatarUrl}
      preferredHero={data.preferredHero}
      heroes={HEROES}
      deleteError={query.error === 'self-destruct'}
    />
  )
}

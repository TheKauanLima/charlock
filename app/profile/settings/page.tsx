import { redirect } from 'next/navigation'

import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import ProfileSettings from '@/components/UserProfile/ProfileSettings'
import { HEROES } from '@/lib/hero-data'
import { getCurrentProfileUser, getProfilePathSegment, getUserProfile, isProfileUnavailableError } from '@/lib/profile'

export const dynamic = 'force-dynamic'

interface ProfileSettingsPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const query = await searchParams
  let currentUser

  try {
    currentUser = await getCurrentProfileUser()
  } catch (error) {
    if (isProfileUnavailableError(error)) {
      return <ProfileUnavailable />
    }

    throw error
  }

  if (!currentUser) {
    redirect('/sign-in')
  }

  let data

  try {
    data = await getUserProfile(getProfilePathSegment(currentUser))
  } catch (error) {
    if (isProfileUnavailableError(error)) {
      return <ProfileUnavailable />
    }

    throw error
  }

  return (
    <ProfileSettings
      user={{
        ...data.user,
        customBio: currentUser.customBio?.trim() ?? '',
      }}
      avatarUrl={data.avatarUrl}
      preferredHero={data.preferredHero}
      heroes={HEROES}
      deleteError={query.error === 'delete-confirmation'}
    />
  )
}

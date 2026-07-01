import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import UserProfile from '@/components/UserProfile/UserProfile'
import { HEROES } from '@/lib/hero-data'
import { getUserProfile, isProfilePrivateError, isProfileUnavailableError } from '@/lib/profile'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
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

  return <UserProfile data={data} heroes={HEROES} />
}

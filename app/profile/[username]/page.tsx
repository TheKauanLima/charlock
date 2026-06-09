import UserProfile from '@/components/UserProfile/UserProfile'
import { HEROES } from '@/lib/hero-data'
import { getUserProfile } from '@/lib/profile'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const data = await getUserProfile(username)

  return <UserProfile data={data} heroes={HEROES} />
}

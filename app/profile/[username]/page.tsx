import ProfileDossier from '@/components/UserProfile/ProfileDossier'
import { HEROES } from '@/lib/hero-data'
import { getProfileDossier } from '@/lib/profile'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const data = await getProfileDossier(username)

  return <ProfileDossier data={data} heroes={HEROES} />
}

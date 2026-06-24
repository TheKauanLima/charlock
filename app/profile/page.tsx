import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import { getCurrentProfileUser, getProfileRedirectPath, isProfileUnavailableError } from '@/lib/profile'

export const dynamic = 'force-dynamic'

export default async function ProfileIndexPage() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect('/sign-in')
  }

  let user

  try {
    user = await getCurrentProfileUser()
  } catch (error) {
    if (isProfileUnavailableError(error)) {
      return <ProfileUnavailable />
    }

    throw error
  }

  if (!user) {
    redirect('/sign-in')
  }

  redirect(getProfileRedirectPath(user))
}

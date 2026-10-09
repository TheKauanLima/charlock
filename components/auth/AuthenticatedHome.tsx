'use client'

import { useUser } from '@clerk/nextjs'
import type { ReactNode } from 'react'

import HeroGrid from '@/components/HeroGrid/HeroGrid'
import type { HeroGridProps } from '@/components/HeroGrid/HeroGrid'

type AuthenticatedHomeProps = HeroGridProps & {
  guestContent: ReactNode
}

export default function AuthenticatedHome({ guestContent, ...heroGridProps }: AuthenticatedHomeProps) {
  const { isLoaded, isSignedIn } = useUser()

  // The server can report a stale signed-out session while Clerk's browser
  // session is already live (see "Live Clerk session reconciliation" in
  // context/progress-tracker.md), so the live check still promotes those users
  // to the app. Guests and the not-yet-loaded state see the guest content.
  if (isLoaded && isSignedIn) {
    return <HeroGrid {...heroGridProps} />
  }

  return guestContent
}

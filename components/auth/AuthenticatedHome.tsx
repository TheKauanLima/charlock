'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import HeroGrid from '@/components/HeroGrid/HeroGrid'
import type { HeroGridProps } from '@/components/HeroGrid/HeroGrid'

import AuthShell from './AuthShell'
import styles from './auth-ui.module.css'

export default function AuthenticatedHome(props: HeroGridProps) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-up')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <AuthShell eyebrow="Session Check" title="Connecting">
        <p className={styles.sessionStatus} role="status">
          {isLoaded ? 'Opening account creation...' : 'Checking your session...'}
        </p>
      </AuthShell>
    )
  }

  return <HeroGrid {...props} />
}

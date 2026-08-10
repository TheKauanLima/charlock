'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import AuthShell from './AuthShell'
import styles from './auth-ui.module.css'

interface GuestOnlyAuthProps {
  children: ReactNode
}

export default function GuestOnlyAuth({ children }: GuestOnlyAuthProps) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || isSignedIn) {
    return (
      <AuthShell eyebrow="Session Active" title="Returning">
        <p className={styles.sessionStatus} role="status">
          {isLoaded ? 'Opening your account...' : 'Checking your session...'}
        </p>
      </AuthShell>
    )
  }

  return children
}

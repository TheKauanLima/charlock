'use client'

import { useClerk } from '@clerk/nextjs'

interface ClerkSecurityButtonProps {
  className: string
}

export default function ClerkSecurityButton({ className }: ClerkSecurityButtonProps) {
  const { openUserProfile } = useClerk()

  return (
    <button type="button" className={className} onClick={() => openUserProfile()}>
      Two-Factor Auth
    </button>
  )
}

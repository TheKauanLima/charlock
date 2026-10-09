'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

import { LANDING_GUEST_HREF } from './landing-content'

interface LandingNavLinkProps {
  label: string
  signedInHref: string
  className?: string
  onNavigate?: () => void
}

export default function LandingNavLink({ label, signedInHref, className, onNavigate }: LandingNavLinkProps) {
  const { isLoaded, isSignedIn } = useUser()
  // Not-yet-loaded Clerk state is treated as signed out.
  const href = isLoaded && isSignedIn ? signedInHref : LANDING_GUEST_HREF

  return (
    <Link className={className} href={href} onClick={onNavigate}>
      {label}
    </Link>
  )
}

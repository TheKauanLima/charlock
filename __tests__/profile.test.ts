import { describe, expect, it } from 'vitest'

import { getProfileHero, getProfilePathSegment, getProfileRedirectPath, getUserLevel, isProfilePathSegmentForUser, isProfileUnavailableError, ProfileUnavailableError } from '@/lib/profile'

describe('profile helpers', () => {
  it('calculates user level from contribution count', () => {
    expect(getUserLevel(0)).toMatchObject({ label: 'New User', nextAt: 6 })
    expect(getUserLevel(6)).toMatchObject({ label: 'Contributor', nextAt: 21 })
    expect(getUserLevel(21)).toMatchObject({ label: 'Power User', nextAt: 51 })
    expect(getUserLevel(51)).toMatchObject({ label: 'Community Leader', nextAt: null })
  })

  it('falls back to Abrams for unknown profile heroes', () => {
    expect(getProfileHero('missing').slug).toBe('abrams')
  })

  it('uses username before clerk id for profile paths', () => {
    expect(getProfilePathSegment({ username: 'profile one', clerkId: 'clerk_123' })).toBe('profile%20one')
    expect(getProfilePathSegment({ username: null, clerkId: 'clerk_123' })).toBe('clerk_123')
  })

  it('builds the canonical profile redirect path', () => {
    expect(getProfileRedirectPath({ username: 'profile one', clerkId: 'clerk_123' })).toBe('/profile/profile%20one')
    expect(getProfileRedirectPath({ username: '', clerkId: 'clerk_123' })).toBe('/profile/clerk_123')
  })

  it('matches profile route segments for a current user', () => {
    expect(isProfilePathSegmentForUser('profile%20one', { username: 'profile one', clerkId: 'clerk_123' })).toBe(true)
    expect(isProfilePathSegmentForUser('clerk_123', { username: null, clerkId: 'clerk_123' })).toBe(true)
    expect(isProfilePathSegmentForUser('other-user', { username: 'profile one', clerkId: 'clerk_123' })).toBe(false)
  })

  it('classifies temporary profile availability errors', () => {
    expect(isProfileUnavailableError(new ProfileUnavailableError())).toBe(true)
    expect(isProfileUnavailableError(new Error('missing'))).toBe(false)
  })
})

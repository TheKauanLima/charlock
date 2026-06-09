import { describe, expect, it } from 'vitest'

import { getProfileHero, getProfilePathSegment, getUserLevel } from '@/lib/profile'

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
})

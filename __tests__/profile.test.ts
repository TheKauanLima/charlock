import { describe, expect, it } from 'vitest'

import { getDetectiveRank, getProfileHero, getProfilePathSegment } from '@/lib/profile'

describe('profile helpers', () => {
  it('calculates detective rank from contribution count', () => {
    expect(getDetectiveRank(0)).toMatchObject({ label: 'Rookie', nextAt: 6 })
    expect(getDetectiveRank(6)).toMatchObject({ label: 'Investigator', nextAt: 21 })
    expect(getDetectiveRank(21)).toMatchObject({ label: 'Lead Detective', nextAt: 51 })
    expect(getDetectiveRank(51)).toMatchObject({ label: 'Chief of Occult Crimes', nextAt: null })
  })

  it('falls back to Abrams for unknown profile heroes', () => {
    expect(getProfileHero('missing').slug).toBe('abrams')
  })

  it('uses username before clerk id for profile paths', () => {
    expect(getProfilePathSegment({ username: 'detective one', clerkId: 'clerk_123' })).toBe('detective%20one')
    expect(getProfilePathSegment({ username: null, clerkId: 'clerk_123' })).toBe('clerk_123')
  })
})

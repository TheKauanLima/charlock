import { describe, expect, it } from 'vitest'

import {
  appendUsernameCollisionSuffix,
  generateProfileUsername,
  getProfileUsernameError,
} from '@/lib/usernames'

describe('profile usernames', () => {
  it('generates a stable, URL-safe username from the new account identity', () => {
    const input = {
      clerkId: 'user_google_123',
      email: 'fallback@example.com',
      firstName: 'João',
      lastName: 'Da Silva',
    }

    const username = generateProfileUsername(input)

    expect(username).toMatch(/^joao_da_silva_[a-z0-9]{6}$/)
    expect(generateProfileUsername(input)).toBe(username)
    expect(username.length).toBeLessThanOrEqual(32)
  })

  it('validates editable usernames and reserves the settings route', () => {
    expect(getProfileUsernameError('valid_Name_2')).toBeNull()
    expect(getProfileUsernameError('ab')).toMatch(/3-32/)
    expect(getProfileUsernameError('not valid')).toMatch(/letters, numbers, and underscores/)
    expect(getProfileUsernameError('SETTINGS')).toMatch(/reserved/)
  })

  it('keeps collision suffixes inside the maximum length', () => {
    const username = appendUsernameCollisionSuffix('a'.repeat(32), 12)

    expect(username).toBe(`${'a'.repeat(29)}_12`)
    expect(username).toHaveLength(32)
  })
})

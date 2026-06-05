import { describe, expect, it } from 'vitest'

import HeroInfo from '@/lib/models/HeroInfo'
import User from '@/lib/models/User'
import { statSchema } from '@/lib/models/WeaponStats'

describe('Mongoose model schemas', () => {
  it('allows melee scaling on panel stats', () => {
    const scalingPath = statSchema.path('scaling')

    expect(scalingPath).toHaveProperty('enumValues', ['none', 'spirit', 'courage', 'melee', 'boon'])
  })

  it('stores hero tag offsets and optional backstory', () => {
    expect(HeroInfo.schema.path('createdByUserId')).toBeDefined()
    expect(HeroInfo.schema.path('tag1OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('tag2OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('tag3OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('backstory')).toBeDefined()
  })

  it('stores profile preferences and privacy settings', () => {
    expect(User.schema.path('preferredHero')).toBeDefined()
    expect(User.schema.path('isPublic')).toBeDefined()
    expect(User.schema.path('anonymousEdits')).toBeDefined()
    expect(User.schema.path('customBio')).toBeDefined()
  })
})

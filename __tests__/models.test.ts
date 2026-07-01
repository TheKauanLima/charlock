import { describe, expect, it } from 'vitest'

import CustomHero from '@/lib/models/CustomHero'
import Hero from '@/lib/models/Hero'
import HeroInfo from '@/lib/models/HeroInfo'
import AbilityStats from '@/lib/models/AbilityStats'
import User from '@/lib/models/User'
import Comment from '@/lib/models/Comment'
import Follow from '@/lib/models/Follow'
import Like from '@/lib/models/Like'
import Notification from '@/lib/models/Notification'
import { statSchema } from '@/lib/models/WeaponStats'

describe('Mongoose model schemas', () => {
  it('allows melee scaling on panel stats', () => {
    const scalingPath = statSchema.path('scaling')

    expect(scalingPath).toHaveProperty('enumValues', ['none', 'spirit', 'courage', 'melee', 'boon'])
    expect(statSchema.path('iconColor')).toBeDefined()
    expect(statSchema.path('append')).toBeDefined()
    expect(statSchema.options._id).toBe(false)
  })

  it('stores hero tag offsets and optional backstory', () => {
    expect(HeroInfo.schema.path('createdByUserId')).toBeDefined()
    expect(HeroInfo.schema.path('tag1OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('tag2OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('tag3OffsetY')).toBeDefined()
    expect(HeroInfo.schema.path('nameFontSize')).toBeDefined()
    expect(HeroInfo.schema.path('nameFontFamily')).toBeDefined()
    expect(HeroInfo.schema.path('nameFontWeight')).toBeDefined()
    expect(HeroInfo.schema.path('backstory')).toBeDefined()
  })

  it('stores ability editor sections with four required abilities', () => {
    const abilitiesPath = AbilityStats.schema.path('abilities')
    const sectionTypePath = AbilityStats.schema.path('abilities.sections.type')
    const mainCellScalingPath = AbilityStats.schema.path('abilities.sections.mainCells.scaling')
    const mainCellIconColorPath = AbilityStats.schema.path('abilities.sections.mainCells.iconColor')
    const mainCellAppendPath = AbilityStats.schema.path('abilities.sections.mainCells.append')
    const tierPath = AbilityStats.schema.path('abilities.tiers.tier')
    const tierUpgradeTextPath = AbilityStats.schema.path('abilities.tiers.upgradeText')
    const tierVariantSectionsPath = AbilityStats.schema.path('abilities.tiers.variant.sections')
    const secondaryAbilitiesPath = AbilityStats.schema.path('secondaryAbilities')
    const secondaryAbilityNamePath = AbilityStats.schema.path('secondaryAbilities.name')
    const secondaryAbilitySlotsPath = AbilityStats.schema.path('secondaryAbilitySlots')
    const secondaryAbilityAnchorPath = AbilityStats.schema.path('secondaryAbilityAnchorIndex')

    expect(AbilityStats.collection.name).toBe('abilitystats')
    expect(AbilityStats.schema.path('heroId')).toBeDefined()
    expect(abilitiesPath).toBeDefined()
    expect(sectionTypePath).toHaveProperty('enumValues', ['richText', 'grid'])
    expect(mainCellScalingPath).toHaveProperty('enumValues', ['none', 'spirit', 'courage', 'melee', 'boon'])
    expect(mainCellIconColorPath).toBeDefined()
    expect(mainCellAppendPath).toBeDefined()
    expect(tierPath).toHaveProperty('enumValues', [1, 2, 3])
    expect(tierUpgradeTextPath).toBeDefined()
    expect(tierVariantSectionsPath).toBeDefined()
    expect(secondaryAbilitiesPath).toBeDefined()
    expect(secondaryAbilityNamePath).toBeDefined()
    expect(secondaryAbilitySlotsPath).toBeDefined()
    expect(secondaryAbilityAnchorPath).toBeDefined()
    expect(abilitiesPath).toHaveProperty('schema.options._id', false)
  })

  it('stores profile preferences and privacy settings', () => {
    expect(User.schema.path('preferredHero')).toBeDefined()
    expect(User.schema.path('profileBackground')).toBeDefined()
    expect(User.schema.path('isPublic')).toBeDefined()
    expect(User.schema.path('anonymousEdits')).toBeDefined()
    expect(User.schema.path('customBio')).toBeDefined()
    expect(User.schema.path('bookmarks')).toBeDefined()
  })

  it('stores official hero asset identity in the heroes collection', () => {
    expect(Hero.collection.name).toBe('heroes')
    expect(Hero.schema.path('name')).toBeDefined()
    expect(Hero.schema.path('slug')).toBeDefined()
    expect(Hero.schema.path('assetSlug')).toBeDefined()
    expect(Hero.schema.path('portrait')).toBeDefined()
    expect(Hero.schema.path('render')).toBeDefined()
    expect(Hero.schema.path('status')).not.toBeDefined()
    expect(Hero.schema.path('createdByUserId')).not.toBeDefined()
  })

  it('stores publishing state and community likes on custom heroes', () => {
    const statusPath = CustomHero.schema.path('status')

    expect(CustomHero.collection.name).toBe('customheroes')
    expect(statusPath).toHaveProperty('enumValues', ['private', 'published'])
    expect(CustomHero.schema.path('background')).toBeDefined()
    expect(CustomHero.schema.path('likesCount')).toBeDefined()
    expect(CustomHero.schema.path('likedBy')).toBeDefined()
    expect(CustomHero.schema.path('allowCopies')).toBeDefined()
    expect(CustomHero.schema.path('publishedAt')).toBeDefined()
  })

  it('stores social comments and follow relationships', () => {
    expect(Comment.schema.path('heroId')).toBeDefined()
    expect(Comment.schema.path('userId')).toBeDefined()
    expect(Comment.schema.path('content')).toBeDefined()
    expect(Follow.schema.path('followerId')).toBeDefined()
    expect(Follow.schema.path('followingId')).toBeDefined()
    expect(Like.schema.path('heroId')).toBeDefined()
    expect(Like.schema.path('userId')).toBeDefined()
    expect(Notification.schema.path('recipientId')).toBeDefined()
    expect(Notification.schema.path('actorId')).toBeDefined()
    expect(Notification.schema.path('targetId')).toBeDefined()
    expect(Notification.schema.path('relatedHeroId')).toBeDefined()
    expect(Notification.schema.path('read')).toBeDefined()
    expect(Notification.schema.path('type')).toHaveProperty('enumValues', ['like', 'comment', 'follow', 'publish'])
  })
})

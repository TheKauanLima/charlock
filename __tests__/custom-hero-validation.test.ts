import { describe, expect, it } from 'vitest'

import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { getCustomHeroSaveIssueMessages, getMissingAbilityIconSaveIssueMessages } from '@/lib/custom-hero-validation'
import type { CustomHeroSavePayload } from '@/lib/custom-hero-types'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

function buildValidPayload(): CustomHeroSavePayload {
  const hero = HEROES[0]
  const stats = buildHeroStatsSeed(hero)

  return {
    id: null,
    name: 'Friendly Draft',
    status: 'private',
    hero: {
      portrait: hero.portrait,
      render: hero.render,
      background: hero.render,
      renderPosition: { x: 0, y: 0 },
    },
    allowCopies: false,
    heroInfo: hero.heroInfo,
    boon: stats.boon,
    weapon: stats.weapon,
    vitality: stats.vitality,
    spirit: stats.spirit,
    abilityStats: buildDefaultAbilityStats(hero),
  }
}

describe('custom hero validation messages', () => {
  it('returns friendly field-specific save blockers', () => {
    const payload = buildValidPayload()
    const messages = getCustomHeroSaveIssueMessages({
      ...payload,
      name: 'A'.repeat(121),
      heroInfo: {
        ...payload.heroInfo,
        backstory: 'B'.repeat(10001),
      },
      weapon: {
        ...payload.weapon,
        weaponAttributes: Array.from({ length: 21 }, (_, index) => `Tag ${index + 1}`),
      },
      hero: {
        ...payload.hero,
        renderPosition: { x: 2001, y: 0 },
      },
    })

    expect(messages).toEqual(expect.arrayContaining([
      'Hero name must be 120 characters or fewer.',
      'Backstory must be 10000 characters or fewer.',
      'Weapon tags can include at most 20 items.',
      'Hero render horizontal position must be 2000 or less.',
    ]))
    expect(messages.join(' ')).not.toMatch(/too_big|expected|string|array/i)
  })

  it('returns coherent messages for unsupported draft fields', () => {
    const payload = {
      ...buildValidPayload(),
      heroInfo: {
        ...buildValidPayload().heroInfo,
        unknownField: 'nope',
      },
    } as unknown as CustomHeroSavePayload

    expect(getCustomHeroSaveIssueMessages(payload)).toContain('Hero info includes fields that cannot be saved: unknownField.')
  })

  it('explains missing ability icons before the draft reaches the database save', () => {
    const payload = buildValidPayload()

    payload.abilityStats.abilities[1] = {
      ...payload.abilityStats.abilities[1],
      icon: '',
    }
    payload.abilityStats.secondaryAbilities = [{
      ...payload.abilityStats.abilities[0],
      icon: '   ',
    }]

    expect(getMissingAbilityIconSaveIssueMessages(payload)).toEqual(expect.arrayContaining([
      'Ability 2 icon is required. Open Ability 2 and choose an ability icon.',
      'Secondary ability 1 icon is required. Open that secondary ability and choose an ability icon.',
    ]))
    expect(getCustomHeroSaveIssueMessages(payload)).not.toContain('Ability 2 icon is required. Open Ability 2 and choose an ability icon.')
  })
})

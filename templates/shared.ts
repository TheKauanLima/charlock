import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import type { CustomHeroDetail } from '@/lib/custom-hero-types'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
import type { PanelStat } from '@/components/panels/scaling-utils'
import { buildSpiritPowerStat, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
import { buildVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'

import type { HeroTemplateDefinition, HeroTemplateId } from './types'

const GENERIC_BACKGROUND = '/panorama/images/heroes/backgrounds/generic_bg_psd.png'
const GENERIC_GUN = '/panorama/images/heroes/guns/generic_gun_psd.png'
const TEMPLATE_TIMESTAMP = '2026-01-01T00:00:00.000Z'

const EMPTY_HERO_INFO: HeroInfoDefinition = {
  nameType: 'text',
  nameValue: 'NAME',
  nameColor: '#f5eadb',
  nameFontSize: 'clamp(1.5rem, 3vw, 3.3rem)',
  nameFontFamily: 'var(--block, VALVEPulp, "Noto Sans", sans-serif)',
  nameFontWeight: '900',
  tag1Text: 'TAG 1',
  tag2Text: 'TAG 2',
  tag3Text: 'TAG 3',
  tagColor: '#777777',
  tagTextColor: '#f5eadb',
  tag1Tilt: 0,
  tag2Tilt: 0,
  tag3Tilt: 0,
  tag1OffsetY: 0,
  tag2OffsetY: 0,
  tag3OffsetY: 0,
  ability1Icon: '',
  ability2Icon: '',
  ability3Icon: '',
  ability4Icon: '',
  abilityCircleColor: '#777777',
  abilityIconColor: '#f5eadb',
  backstory: '',
}

const EMPTY_HERO_BASE: HeroDefinition = {
  slug: 'empty-template',
  assetSlug: 'generic',
  displayName: 'NAME',
  portrait: GENERIC_BACKGROUND,
  render: '',
  heroInfo: EMPTY_HERO_INFO,
}

function withoutScaling(stat: PanelStat): PanelStat {
  return {
    ...stat,
    value: String(stat.value),
    scaling: 'none',
    scalingValue: '0',
  }
}

function buildEmptyStats(hero: HeroDefinition): HeroStatsPayload {
  const weaponStats = buildWeaponStatsArray({
    bullet_damage: 0,
    weapon_damage_percent: 0,
    bullets_per_sec: 0,
    fire_rate_percent: 0,
    ammo: 0,
    clip_size_increase_percent: 0,
    reload_time: 0,
    reload_reduction_percent: 0,
    bullet_velocity: 0,
    bullet_velocity_increase_percent: 0,
    bullet_lifesteal_percent: 0,
    crit_bonus_scale_percent: 0,
    light_melee_damage: 63,
    heavy_melee_damage: 116,
  }).map(withoutScaling)

  const vitalityStats = buildVitalityStatsArray({
    max_health: 0,
    health_regen: 0,
    heal_amp_percent: 0,
    non_combat_regen: 0,
    bullet_resist_percent: 0,
    spirit_resist_percent: 0,
    melee_resist_percent: 0,
    debuff_resist_percent: 0,
    crit_reduction_percent: 0,
    move_speed: 0,
    sprint_speed: 0,
    stamina_cooldown: 0,
    stamina_recovery_percent: 0,
    stamina: 0,
    dash_speed: 0,
  }).map(withoutScaling)

  const spiritTopStats = buildTopSpiritStatsArray({
    ability_cooldown_percent: 0,
    ability_duration_percent: 0,
    ability_range_percent: 0,
    spirit_lifesteal_percent: 0,
    max_charges_increase: 0,
    charge_cooldown_percent: 0,
  }).map(withoutScaling)

  return {
    hero: {
      slug: hero.slug,
      name: hero.displayName,
      portrait: hero.portrait,
      render: hero.render,
    },
    heroInfo: hero.heroInfo,
    weapon: {
      weaponName: 'WEAPON NAME',
      weaponDesc: 'Weapon description.',
      gunImageSrc: GENERIC_GUN,
      weaponAttributes: [],
      bulletDPS: 0,
      weaponMinRange: 0,
      weaponMaxRange: 0,
      stats: weaponStats,
    },
    vitality: {
      stats: vitalityStats,
    },
    spirit: {
      topStats: spiritTopStats,
      spiritPowerStat: {
        ...withoutScaling(buildSpiritPowerStat({ spirit_power: 0 })),
        description: '',
      },
    },
  }
}

function buildEmptyAbilityStats(hero: HeroDefinition) {
  const defaults = buildDefaultAbilityStats(hero)

  return {
    abilities: defaults.abilities.map(ability => ({
      ...ability,
      name: `Ability ${ability.slot}`,
      icon: '',
      cooldown: {
        ...ability.cooldown,
        value: '10',
        unit: 's',
        scaling: 'none' as const,
        scalingValue: '0',
      },
      hasCharges: false,
      charges: {
        ...ability.charges,
        value: '0',
        scaling: 'none' as const,
        scalingValue: '0',
      },
      rechargeTime: {
        ...ability.rechargeTime,
        value: '10',
        unit: 's',
        scaling: 'none' as const,
        scalingValue: '0',
      },
      subStats: [],
      sections: [],
      tiers: ability.tiers.map(tier => ({
        tier: tier.tier,
        upgradeText: '',
        variant: {
          ...tier.variant,
          name: `Ability ${ability.slot}`,
          icon: '',
          cooldown: {
            ...tier.variant.cooldown,
            value: '10',
            unit: 's',
            scaling: 'none' as const,
            scalingValue: '0',
          },
          hasCharges: false,
          charges: {
            ...tier.variant.charges,
            value: '0',
            scaling: 'none' as const,
            scalingValue: '0',
          },
          rechargeTime: {
            ...tier.variant.rechargeTime,
            value: '10',
            unit: 's',
            scaling: 'none' as const,
            scalingValue: '0',
          },
          subStats: [],
          sections: [],
        },
      })),
    })),
  }
}

export function buildTemplateDefinition(id: HeroTemplateId, label: string, available: boolean): HeroTemplateDefinition {
  const hero: HeroDefinition = {
    ...EMPTY_HERO_BASE,
    slug: `${id}-template`,
    displayName: label === 'EMPTY' ? 'NAME' : label,
    heroInfo: { ...EMPTY_HERO_INFO },
  }

  return {
    id,
    label,
    available,
    hero: {
      ...hero,
      id: `template-${id}`,
      creatorId: 'template',
      status: 'private',
      likesCount: 0,
      likedByCurrentUser: false,
      bookmarkedByCurrentUser: false,
      allowCopies: false,
      background: GENERIC_BACKGROUND,
      viewerCanEdit: false,
      publishedAt: null,
      createdAt: TEMPLATE_TIMESTAMP,
      updatedAt: TEMPLATE_TIMESTAMP,
      stats: buildEmptyStats(hero),
      abilityStats: buildEmptyAbilityStats(hero),
    } satisfies CustomHeroDetail,
  }
}

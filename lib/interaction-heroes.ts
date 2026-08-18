import { HEROES } from '@/lib/hero-data'
import type { CustomHeroSummary, HeroInteraction } from '@/lib/custom-hero-types'

export interface InteractionRosterHero {
  id: string
  name: string
  portrait: string
  smallPortrait: string
  isCustom?: boolean
}

const SMALL_PORTRAIT_ASSET_BY_HERO: Record<string, string> = {
  abrams: 'bull_sm_psd.png',
  apollo: 'fencer_sm_psd.png',
  bebop: 'bebop_sm_psd.png',
  billy: 'punkgoat_sm_psd.png',
  calico: 'nano_sm_psd.png',
  celeste: 'unicorn_sm_psd.png',
  doorman: 'doorman_sm_psd.png',
  drifter: 'drifter_sm_psd.png',
  dynamo: 'sumo_sm_psd.png',
  graves: 'necro_sm_psd.png',
  greytalon: 'archer_sm_psd.png',
  haze: 'haze_sm_psd.png',
  holliday: 'astro_sm_psd.png',
  infernus: 'inferno_sm_psd.png',
  ivy: 'tengu_sm_psd.png',
  kelvin: 'kelvin_sm_psd.png',
  ladygeist: 'spectre_sm_psd.png',
  lash: 'lash_sm_psd.png',
  mcginnis: 'engineer_sm_psd.png',
  mina: 'vampirebat_sm_psd.png',
  mirage: 'mirage_sm_psd.png',
  paige: 'bookworm_sm_psd.png',
  paradox: 'chrono_sm_psd.png',
  pocket: 'synth_sm_psd.png',
  rem: 'familiar_sm_psd.png',
  seven: 'gigawatt_sm_psd.png',
  shiv: 'shiv_sm_psd.png',
  silver: 'werewolf_sm_psd.png',
  sinclair: 'magician_sm_psd.png',
  venator: 'priest_sm_psd.png',
  victor: 'frank_sm_psd.png',
  vindicta: 'hornet_sm_psd_d09ce06e.png',
  viscous: 'viscous_sm_psd.png',
  vyper: 'kali_sm_psd.png',
  warden: 'warden_sm_psd.png',
  wraith: 'wraith_sm_psd.png',
  yamato: 'yamato_sm_psd.png',
}

export const INTERACTION_ROSTER_HEROES: InteractionRosterHero[] = HEROES.map(hero => {
  const smallPortraitAsset = SMALL_PORTRAIT_ASSET_BY_HERO[hero.slug]

  return {
    id: hero.slug,
    name: hero.displayName,
    portrait: hero.portrait,
    smallPortrait: smallPortraitAsset
      ? `/panorama/images/heroes/${smallPortraitAsset}`
      : hero.portrait,
  }
})

export function getInteractionRosterHero(heroId: string) {
  return INTERACTION_ROSTER_HEROES.find(hero => hero.id === heroId) ?? null
}

export function buildCustomInteractionHeroes(
  heroes: CustomHeroSummary[],
  excludedHeroId?: string | null,
): InteractionRosterHero[] {
  return heroes
    .filter(hero => hero.id !== excludedHeroId)
    .map(hero => ({
      id: hero.id,
      name: hero.displayName,
      portrait: hero.portrait,
      smallPortrait: hero.portrait,
      isCustom: true,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

export function getInteractionTargetHero(
  interaction: Pick<HeroInteraction, 'targetHeroId' | 'targetHeroName' | 'targetHeroPortrait'>,
  customHeroes: InteractionRosterHero[] = [],
): InteractionRosterHero | null {
  const knownHero = getInteractionRosterHero(interaction.targetHeroId)
    ?? customHeroes.find(hero => hero.id === interaction.targetHeroId)

  if (knownHero) return knownHero

  return interaction.targetHeroPortrait
    ? {
        id: interaction.targetHeroId,
        name: interaction.targetHeroName,
        portrait: interaction.targetHeroPortrait,
        smallPortrait: interaction.targetHeroPortrait,
        isCustom: true,
      }
    : null
}

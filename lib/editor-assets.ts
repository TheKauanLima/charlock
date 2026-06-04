import { HEROES } from '@/lib/hero-data'

export interface HeroBackgroundOption {
  label: string
  path: string
}

export interface AbilityIconGroup {
  heroSlug: string
  heroName: string
  icons: [string, string, string, string]
}

export interface EditorAssetOption {
  label: string
  path: string
}

export interface EditorAssetGroup {
  id: string
  label: string
  assets: EditorAssetOption[]
}

export interface EditorRenderSelection {
  mode: 'background' | 'custom' | 'hero'
  src: string | null
}

const HERO_BACKGROUND_PATHS = [
  '/panorama/images/heroes/backgrounds/abrams_bg_psd.png',
  '/panorama/images/heroes/backgrounds/astro_bg_psd.png',
  '/panorama/images/heroes/backgrounds/bebop_bg_psd.png',
  '/panorama/images/heroes/backgrounds/billy_bg_psd.png',
  '/panorama/images/heroes/backgrounds/calico_bg_psd.png',
  '/panorama/images/heroes/backgrounds/doorman_bg_psd.png',
  '/panorama/images/heroes/backgrounds/drifter_bg_psd.png',
  '/panorama/images/heroes/backgrounds/dynamo_bg_psd.png',
  '/panorama/images/heroes/backgrounds/familiar_bg_psd.png',
  '/panorama/images/heroes/backgrounds/fencer_bg_psd.png',
  '/panorama/images/heroes/backgrounds/geist_bg_psd.png',
  '/panorama/images/heroes/backgrounds/generic_bg_psd.png',
  '/panorama/images/heroes/backgrounds/grey_talon_bg_psd.png',
  '/panorama/images/heroes/backgrounds/haze_bg_psd.png',
  '/panorama/images/heroes/backgrounds/infernus_bg_psd.png',
  '/panorama/images/heroes/backgrounds/ivy_bg_psd.png',
  '/panorama/images/heroes/backgrounds/kelvin_bg_psd.png',
  '/panorama/images/heroes/backgrounds/krill_bg_psd.png',
  '/panorama/images/heroes/backgrounds/lash_bg_psd.png',
  '/panorama/images/heroes/backgrounds/magician_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mcginnis_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mina_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mirage_bg_psd.png',
  '/panorama/images/heroes/backgrounds/necro_bg_psd.png',
  '/panorama/images/heroes/backgrounds/paradox_bg_psd.png',
  '/panorama/images/heroes/backgrounds/patience_bg_psd.png',
  '/panorama/images/heroes/backgrounds/pocket_bg_psd.png',
  '/panorama/images/heroes/backgrounds/priest_bg_psd.png',
  '/panorama/images/heroes/backgrounds/seven_bg_psd.png',
  '/panorama/images/heroes/backgrounds/shiv_bg_psd.png',
  '/panorama/images/heroes/backgrounds/unicorn_bg_psd.png',
  '/panorama/images/heroes/backgrounds/victor_bg_psd.png',
  '/panorama/images/heroes/backgrounds/vindicta_bg_psd.png',
  '/panorama/images/heroes/backgrounds/viscous_bg_psd.png',
  '/panorama/images/heroes/backgrounds/vyper_bg_psd.png',
  '/panorama/images/heroes/backgrounds/warden_bg_psd.png',
  '/panorama/images/heroes/backgrounds/werewolf_bg_psd.png',
  '/panorama/images/heroes/backgrounds/wraith_bg_psd.png',
  '/panorama/images/heroes/backgrounds/yamato_bg_psd.png',
] as const

const HERO_WEAPON_IMAGE_PATHS = [
  '/panorama/images/heroes/guns/Abrams_Weapon.png',
  '/panorama/images/heroes/guns/Apollo_Weapon.png',
  '/panorama/images/heroes/guns/Bebop_Weapon.png',
  '/panorama/images/heroes/guns/Billy_Weapon.png',
  '/panorama/images/heroes/guns/Calico_Weapon.png',
  '/panorama/images/heroes/guns/Celeste_Weapon.png',
  '/panorama/images/heroes/guns/Drifter_Weapon.png',
  '/panorama/images/heroes/guns/Dynamo_Weapon.png',
  '/panorama/images/heroes/guns/generic_gun_psd.png',
  '/panorama/images/heroes/guns/Graves_Weapon.png',
  '/panorama/images/heroes/guns/Grey_Talon_Weapon.png',
  '/panorama/images/heroes/guns/Haze_Weapon.png',
  '/panorama/images/heroes/guns/Holliday_Weapon.png',
  '/panorama/images/heroes/guns/Infernus_Weapon.png',
  '/panorama/images/heroes/guns/Ivy_Weapon.png',
  '/panorama/images/heroes/guns/Kelvin_Weapon.png',
  '/panorama/images/heroes/guns/Lady_Geist_Weapon.png',
  '/panorama/images/heroes/guns/Lash_Weapon.png',
  '/panorama/images/heroes/guns/McGinnis_Weapon.png',
  '/panorama/images/heroes/guns/Mina_Weapon.png',
  '/panorama/images/heroes/guns/Mirage_Weapon.png',
  '/panorama/images/heroes/guns/Mo_&_Krill_Weapon.png',
  '/panorama/images/heroes/guns/Paige_Weapon.png',
  '/panorama/images/heroes/guns/Paradox_Weapon.png',
  '/panorama/images/heroes/guns/Pocket_Weapon.png',
  '/panorama/images/heroes/guns/Rem_Weapon.png',
  '/panorama/images/heroes/guns/Seven_Weapon.png',
  '/panorama/images/heroes/guns/Shiv_Weapon.png',
  '/panorama/images/heroes/guns/Silver_Weapon.png',
  '/panorama/images/heroes/guns/Sinclair_Weapon.png',
  '/panorama/images/heroes/guns/The_Doorman_Weapon.png',
  '/panorama/images/heroes/guns/Venator_Weapon.png',
  '/panorama/images/heroes/guns/Victor_Weapon.png',
  '/panorama/images/heroes/guns/Vindicta_Weapon.png',
  '/panorama/images/heroes/guns/Viscous_Weapon.png',
  '/panorama/images/heroes/guns/Vyper_Weapon.png',
  '/panorama/images/heroes/guns/Warden_Weapon.png',
  '/panorama/images/heroes/guns/Wraith_Weapon.png',
  '/panorama/images/heroes/guns/Yamato_Weapon.png',
] as const

function formatBackgroundLabel(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  const rawName = fileName.replace('_bg_psd.png', '')

  return rawName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const HERO_BACKGROUND_OPTIONS: HeroBackgroundOption[] = HERO_BACKGROUND_PATHS.map(path => ({
  label: formatBackgroundLabel(path),
  path,
}))

export const ABILITY_ICON_GROUPS: AbilityIconGroup[] = HEROES.map(hero => ({
  heroSlug: hero.slug,
  heroName: hero.displayName,
  icons: [hero.heroInfo.ability1Icon, hero.heroInfo.ability2Icon, hero.heroInfo.ability3Icon, hero.heroInfo.ability4Icon],
}))

function formatWeaponLabel(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  const rawName = fileName.replace('_Weapon.png', '').replace('_gun_psd.png', ' gun')

  return rawName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const WEAPON_IMAGE_GROUPS: EditorAssetGroup[] = [
  {
    id: 'hero-weapons',
    label: 'Hero Weapons',
    assets: HERO_WEAPON_IMAGE_PATHS.map(path => ({
      label: formatWeaponLabel(path),
      path,
    })),
  },
]

export const HERO_RENDER_GROUPS: EditorAssetGroup[] = [
  {
    id: 'hero-renders',
    label: 'Hero Renders',
    assets: HEROES.map(hero => ({
      label: hero.displayName,
      path: hero.render,
    })),
  },
]

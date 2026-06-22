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

const PROPERTY_ICON_PATHS = [
  '/panorama/images/icons/properties/ammo.svg',
  '/panorama/images/icons/properties/ammo_clip_size.svg',
  '/panorama/images/icons/properties/ammo_reload.svg',
  '/panorama/images/icons/properties/ammo_reload_auto.svg',
  '/panorama/images/icons/properties/ammo_reload_fast.svg',
  '/panorama/images/icons/properties/armor.svg',
  '/panorama/images/icons/properties/armor_alt.svg',
  '/panorama/images/icons/properties/armor_bullet.svg',
  '/panorama/images/icons/properties/armor_bullet_color.svg',
  '/panorama/images/icons/properties/armor_melee.svg',
  '/panorama/images/icons/properties/armor_melee_color.svg',
  '/panorama/images/icons/properties/armor_spirit.svg',
  '/panorama/images/icons/properties/armor_spirit_color.svg',
  '/panorama/images/icons/properties/bullets_piercing.svg',
  '/panorama/images/icons/properties/bullets_piercing_armor.svg',
  '/panorama/images/icons/properties/bullet_velocity.svg',
  '/panorama/images/icons/properties/charge.svg',
  '/panorama/images/icons/properties/condition_bleed.svg',
  '/panorama/images/icons/properties/condition_burn.svg',
  '/panorama/images/icons/properties/condition_chain.svg',
  '/panorama/images/icons/properties/condition_disarm.svg',
  '/panorama/images/icons/properties/condition_freeze.svg',
  '/panorama/images/icons/properties/condition_immobilize.svg',
  '/panorama/images/icons/properties/condition_knockdown.svg',
  '/panorama/images/icons/properties/condition_shock.svg',
  '/panorama/images/icons/properties/condition_silence.svg',
  '/panorama/images/icons/properties/condition_sleep.svg',
  '/panorama/images/icons/properties/condition_slow.svg',
  '/panorama/images/icons/properties/condition_stun.svg',
  '/panorama/images/icons/properties/condition_toxic.svg',
  '/panorama/images/icons/properties/cooldown.svg',
  '/panorama/images/icons/properties/damage_bullet.svg',
  '/panorama/images/icons/properties/damage_bullet_color.svg',
  '/panorama/images/icons/properties/damage_crit.svg',
  '/panorama/images/icons/properties/damage_crit_color.svg',
  '/panorama/images/icons/properties/damage_magic.svg',
  '/panorama/images/icons/properties/damage_magic_color.svg',
  '/panorama/images/icons/properties/damage_melee.svg',
  '/panorama/images/icons/properties/damage_melee_color.svg',
  '/panorama/images/icons/properties/damage_over_time.svg',
  '/panorama/images/icons/properties/damage_over_time_color.svg',
  '/panorama/images/icons/properties/damage_weapon.svg',
  '/panorama/images/icons/properties/damage_weapon_color.svg',
  '/panorama/images/icons/properties/death.svg',
  '/panorama/images/icons/properties/debuff.svg',
  '/panorama/images/icons/properties/debuff_remove.svg',
  '/panorama/images/icons/properties/duration.svg',
  '/panorama/images/icons/properties/fire_rate.svg',
  '/panorama/images/icons/properties/gun.svg',
  '/panorama/images/icons/properties/heal.svg',
  '/panorama/images/icons/properties/healing_booster.svg',
  '/panorama/images/icons/properties/health.svg',
  '/panorama/images/icons/properties/health_regen.svg',
  '/panorama/images/icons/properties/health_steal.svg',
  '/panorama/images/icons/properties/health_stealing_bullets.svg',
  '/panorama/images/icons/properties/health_stealing_bullets_color.svg',
  '/panorama/images/icons/properties/health_stealing_melee.svg',
  '/panorama/images/icons/properties/health_stealing_melee_color.svg',
  '/panorama/images/icons/properties/health_stealing_spirit.svg',
  '/panorama/images/icons/properties/health_stealing_spirit_color.svg',
  '/panorama/images/icons/properties/melee.svg',
  '/panorama/images/icons/properties/melee_light.svg',
  '/panorama/images/icons/properties/melee_parry.svg',
  '/panorama/images/icons/properties/move_dash.svg',
  '/panorama/images/icons/properties/move_dodge.svg',
  '/panorama/images/icons/properties/move_dodge_recharge.svg',
  '/panorama/images/icons/properties/move_double_jump.svg',
  '/panorama/images/icons/properties/move_slide.svg',
  '/panorama/images/icons/properties/move_speed.svg',
  '/panorama/images/icons/properties/move_sprint.svg',
  '/panorama/images/icons/properties/move_stamina.svg',
  '/panorama/images/icons/properties/move_stamina_recharge.svg',
  '/panorama/images/icons/properties/range.svg',
  '/panorama/images/icons/properties/range_aoe.svg',
  '/panorama/images/icons/properties/range_close.svg',
  '/panorama/images/icons/properties/range_long.svg',
  '/panorama/images/icons/properties/recharge.svg',
  '/panorama/images/icons/properties/resist_bullet.svg',
  '/panorama/images/icons/properties/resist_bullet_color.svg',
  '/panorama/images/icons/properties/resist_melee.svg',
  '/panorama/images/icons/properties/resist_melee_color.svg',
  '/panorama/images/icons/properties/resist_spirit.svg',
  '/panorama/images/icons/properties/resist_spirit_color.svg',
  '/panorama/images/icons/properties/spirit.svg',
  '/panorama/images/icons/properties/visibility.svg',
  '/panorama/images/icons/properties/zipline.svg',
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

function formatPropertyIconLabel(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  const rawName = fileName.replace('.svg', '')

  return rawName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const PROPERTY_ICON_GROUPS: EditorAssetGroup[] = [
  {
    id: 'property-icons',
    label: 'Property Icons',
    assets: PROPERTY_ICON_PATHS.map(path => ({
      label: formatPropertyIconLabel(path),
      path,
    })),
  },
]

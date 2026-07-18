import { HEROES } from '@/lib/hero-data'

export interface HeroBackgroundOption {
  label: string
  path: string
}

export interface AbilityIconGroup {
  heroSlug: string
  heroName: string
  icons: readonly string[]
  useFileLabels?: boolean
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
  position?: RenderPosition
}

export interface RenderPosition {
  x: number
  y: number
}

const HERO_BACKGROUND_PATHS = [
  '/panorama/images/heroes/backgrounds/abrams_bg_psd.png',
  '/panorama/images/heroes/backgrounds/bebop_bg_psd.png',
  '/panorama/images/heroes/backgrounds/billy_bg_psd.png',
  '/panorama/images/heroes/backgrounds/calico_bg_psd.png',
  '/panorama/images/heroes/backgrounds/celeste_bg_psd.png',
  '/panorama/images/heroes/backgrounds/doorman_bg_psd.png',
  '/panorama/images/heroes/backgrounds/drifter_bg_psd.png',
  '/panorama/images/heroes/backgrounds/dynamo_bg_psd.png',
  '/panorama/images/heroes/backgrounds/fencer_bg_psd.png',
  '/panorama/images/heroes/backgrounds/geist_bg_psd.png',
  '/panorama/images/heroes/backgrounds/generic_bg_psd.png',
  '/panorama/images/heroes/backgrounds/graves_bg_psd.png',
  '/panorama/images/heroes/backgrounds/grey_talon_bg_psd.png',
  '/panorama/images/heroes/backgrounds/haze_bg_psd.png',
  '/panorama/images/heroes/backgrounds/holliday_bg_psd.png',
  '/panorama/images/heroes/backgrounds/infernus_bg_psd.png',
  '/panorama/images/heroes/backgrounds/ivy_bg_psd.png',
  '/panorama/images/heroes/backgrounds/kelvin_bg_psd.png',
  '/panorama/images/heroes/backgrounds/lash_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mcginnis_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mina_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mirage_bg_psd.png',
  '/panorama/images/heroes/backgrounds/mo_and_krill_bg_psd.png',
  '/panorama/images/heroes/backgrounds/paige_bg_psd.png',
  '/panorama/images/heroes/backgrounds/paradox_bg_psd.png',
  '/panorama/images/heroes/backgrounds/pocket_bg_psd.png',
  '/panorama/images/heroes/backgrounds/rem_bg_psd.png',
  '/panorama/images/heroes/backgrounds/seven_bg_psd.png',
  '/panorama/images/heroes/backgrounds/shiv_bg_psd.png',
  '/panorama/images/heroes/backgrounds/silver_bg_psd.png',
  '/panorama/images/heroes/backgrounds/sinclair_bg_psd.png',
  '/panorama/images/heroes/backgrounds/venator_bg_psd.png',
  '/panorama/images/heroes/backgrounds/victor_bg_psd.png',
  '/panorama/images/heroes/backgrounds/vindicta_bg_psd.png',
  '/panorama/images/heroes/backgrounds/viscous_bg_psd.png',
  '/panorama/images/heroes/backgrounds/vyper_bg_psd.png',
  '/panorama/images/heroes/backgrounds/warden_bg_psd.png',
  '/panorama/images/heroes/backgrounds/wraith_bg_psd.png',
  '/panorama/images/heroes/backgrounds/yamato_bg_psd.png',
] as const

const HERO_BACKGROUND_LABEL_OVERRIDES: Record<string, string> = {
  geist: 'Lady Geist',
  mo_and_krill: 'Mo & Krill',
}

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

const ABILITY_UPGRADE_ICON_GROUPS: AbilityIconGroup[] = [
  {
    heroSlug: 'upgrade-icons',
    heroName: 'Upgrade Icons',
    useFileLabels: true,
    icons: [
      '/panorama/images/upgrades/ability_upgrade_bg_tile_psd.png',
      '/panorama/images/upgrades/all_stats_psd.png',
      '/panorama/images/upgrades/ammo_icon_psd.png',
      '/panorama/images/upgrades/armor_psd.png',
      '/panorama/images/upgrades/arrow_delta_psd.png',
      '/panorama/images/upgrades/aura_icon_psd.png',
      '/panorama/images/upgrades/checkmark_purchased_psd.png',
      '/panorama/images/upgrades/energy_icon_psd.png',
      '/panorama/images/upgrades/fire_rate_icon_psd.png',
      '/panorama/images/upgrades/infinity_psd.png',
      '/panorama/images/upgrades/lock_icon.svg',
      '/panorama/images/upgrades/lock_icon_psd.png',
      '/panorama/images/upgrades/melee_icon_psd.png',
      '/panorama/images/upgrades/property_bullet_armor_psd.png',
      '/panorama/images/upgrades/property_bullet_dmg.svg',
      '/panorama/images/upgrades/property_cast_psd.png',
      '/panorama/images/upgrades/property_chargeup_large_psd.png',
      '/panorama/images/upgrades/property_charge_cooldown.svg',
      '/panorama/images/upgrades/property_cooldown_large_psd.png',
      '/panorama/images/upgrades/property_crit_reduction.svg',
      '/panorama/images/upgrades/property_generic_psd.png',
      '/panorama/images/upgrades/property_range.svg',
      '/panorama/images/upgrades/property_slow_large_psd.png',
      '/panorama/images/upgrades/property_tech_armor_psd.png',
      '/panorama/images/upgrades/recommended_star_png.png',
      '/panorama/images/upgrades/recommended_star_psd.png',
      '/panorama/images/upgrades/speed_icon_psd.png',
      '/panorama/images/upgrades/tech_power_psd.png',
      '/panorama/images/upgrades/tier_numbers_small_01.svg',
      '/panorama/images/upgrades/tier_numbers_small_01_psd.png',
      '/panorama/images/upgrades/tier_numbers_small_02.svg',
      '/panorama/images/upgrades/tier_numbers_small_02_psd.png',
      '/panorama/images/upgrades/tier_numbers_small_03.svg',
      '/panorama/images/upgrades/tier_numbers_small_03_psd.png',
      '/panorama/images/upgrades/tier_numbers_small_04.svg',
      '/panorama/images/upgrades/tier_numbers_small_05.svg',
      '/panorama/images/upgrades/upgrade_active_enemy_psd.png',
      '/panorama/images/upgrades/upgrade_active_gold_psd.png',
      '/panorama/images/upgrades/upgrade_active_psd.png',
      '/panorama/images/upgrades/upgrade_infinite_psd.png',
      '/panorama/images/upgrades/upgrade_passive_psd.png',
      '/panorama/images/upgrades/upgrade_shield_psd.png',
      '/panorama/images/upgrades/weapon_power_psd.png',
    ],
  },
  {
    heroSlug: 'upgrade-mods-armor',
    heroName: 'Armor Mods',
    useFileLabels: true,
    icons: [
      '/panorama/images/upgrades/mods_armor/advanced_armor_psd.png',
      '/panorama/images/upgrades/mods_armor/base_armor_psd.png',
      '/panorama/images/upgrades/mods_armor/boxing_glove_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_armor_plus_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_armor_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_armor_pulse_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_armor_reduction_aura_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_deflector_psd.png',
      '/panorama/images/upgrades/mods_armor/bullet_shield_psd.png',
      '/panorama/images/upgrades/mods_armor/camouflage_suit_psd.png',
      '/panorama/images/upgrades/mods_armor/cardio_calibrator_psd.png',
      '/panorama/images/upgrades/mods_armor/colossus_psd.png',
      '/panorama/images/upgrades/mods_armor/debuff_reducer_psd.png',
      '/panorama/images/upgrades/mods_armor/debuff_remover_psd.png',
      '/panorama/images/upgrades/mods_armor/double_jump_psd.png',
      '/panorama/images/upgrades/mods_armor/endurance_psd.png',
      '/panorama/images/upgrades/mods_armor/healing_booster_psd.png',
      '/panorama/images/upgrades/mods_armor/health_psd.png',
      '/panorama/images/upgrades/mods_armor/health_regen_aura_psd.png',
      '/panorama/images/upgrades/mods_armor/health_regen_psd.png',
      '/panorama/images/upgrades/mods_armor/health_stealing_bullets_psd.png',
      '/panorama/images/upgrades/mods_armor/health_tank_psd.png',
      '/panorama/images/upgrades/mods_armor/improved_bullet_armor_psd.png',
      '/panorama/images/upgrades/mods_armor/improved_stamina_psd.png',
      '/panorama/images/upgrades/mods_armor/last_stand_psd.png',
      '/panorama/images/upgrades/mods_armor/leech_psd.png',
      '/panorama/images/upgrades/mods_armor/melee_damage_psd.png',
      '/panorama/images/upgrades/mods_armor/melee_deflector_psd.png',
      '/panorama/images/upgrades/mods_armor/melee_electrified_psd.png',
      '/panorama/images/upgrades/mods_armor/melee_knockdown_psd.png',
      '/panorama/images/upgrades/mods_armor/metal_skin_psd.png',
      '/panorama/images/upgrades/mods_armor/overdrive_psd.png',
      '/panorama/images/upgrades/mods_armor/phantom_strike_psd.png',
      '/panorama/images/upgrades/mods_armor/portable_rejuvenator_png.png',
      '/panorama/images/upgrades/mods_armor/resilience_psd.png',
      '/panorama/images/upgrades/mods_armor/restorative_locket_psd.png',
      '/panorama/images/upgrades/mods_armor/revitalizer_psd.png',
      '/panorama/images/upgrades/mods_armor/roll_evasion_psd.png',
      '/panorama/images/upgrades/mods_armor/savior_psd.png',
      '/panorama/images/upgrades/mods_armor/sprint_booster_psd.png',
      '/panorama/images/upgrades/mods_armor/stimpak_psd.png',
      '/panorama/images/upgrades/mods_armor/superior_stamina_psd.png',
      '/panorama/images/upgrades/mods_armor/tech_armor_psd.png',
      '/panorama/images/upgrades/mods_armor/tech_defender_psd.png',
      '/panorama/images/upgrades/mods_armor/tech_purge_psd.png',
      '/panorama/images/upgrades/mods_armor/unstoppable_psd.png',
      '/panorama/images/upgrades/mods_armor/weapon_jammer_psd.png',
    ],
  },
  {
    heroSlug: 'upgrade-mods-tech',
    heroName: 'Tech Mods',
    useFileLabels: true,
    icons: [
      '/panorama/images/upgrades/mods_tech/acolytes_glove_psd.png',
      '/panorama/images/upgrades/mods_tech/advanced_tech_psd.png',
      '/panorama/images/upgrades/mods_tech/arcane_medallion_psd.png',
      '/panorama/images/upgrades/mods_tech/arcane_persistance_psd.png',
      '/panorama/images/upgrades/mods_tech/arcane_surge_psd.png',
      '/panorama/images/upgrades/mods_tech/area_immobilize_psd.png',
      '/panorama/images/upgrades/mods_tech/base_tech_psd.png',
      '/panorama/images/upgrades/mods_tech/blurred_vision_psd.png',
      '/panorama/images/upgrades/mods_tech/boundless_spirit_psd.png',
      '/panorama/images/upgrades/mods_tech/bullet_resist_shredder_psd.png',
      '/panorama/images/upgrades/mods_tech/charmed_wraps_psd.png',
      '/panorama/images/upgrades/mods_tech/clarity_psd.png',
      '/panorama/images/upgrades/mods_tech/disarm_psd.png',
      '/panorama/images/upgrades/mods_tech/duration_extender_psd.png',
      '/panorama/images/upgrades/mods_tech/echo_shard_psd.png',
      '/panorama/images/upgrades/mods_tech/emp_blast_psd.png',
      '/panorama/images/upgrades/mods_tech/escalating_exposure_psd.png',
      '/panorama/images/upgrades/mods_tech/extra_charge_psd.png',
      '/panorama/images/upgrades/mods_tech/focused_silence_psd.png',
      '/panorama/images/upgrades/mods_tech/glitch_psd.png',
      '/panorama/images/upgrades/mods_tech/healbane_psd.png',
      '/panorama/images/upgrades/mods_tech/health_stealing_tech_psd.png',
      '/panorama/images/upgrades/mods_tech/heal_preventer_psd.png',
      '/panorama/images/upgrades/mods_tech/immobilize_psd.png',
      '/panorama/images/upgrades/mods_tech/infuser_psd.png',
      '/panorama/images/upgrades/mods_tech/knockdown_psd.png',
      '/panorama/images/upgrades/mods_tech/magic_burst_psd.png',
      '/panorama/images/upgrades/mods_tech/magic_reverb_psd.png',
      '/panorama/images/upgrades/mods_tech/magic_shock_psd.png',
      '/panorama/images/upgrades/mods_tech/magic_storm_psd.png',
      '/panorama/images/upgrades/mods_tech/medic_beam_psd.png',
      '/panorama/images/upgrades/mods_tech/quantum_chimaera_psd.png',
      '/panorama/images/upgrades/mods_tech/radar_drone_psd.png',
      '/panorama/images/upgrades/mods_tech/rapid_recharge_psd.png',
      '/panorama/images/upgrades/mods_tech/rebirth_psd.png',
      '/panorama/images/upgrades/mods_tech/refresher_module_psd.png',
      '/panorama/images/upgrades/mods_tech/return_fire_psd.png',
      '/panorama/images/upgrades/mods_tech/rupture_psd.png',
      '/panorama/images/upgrades/mods_tech/shifting_shroud_psd.png',
      '/panorama/images/upgrades/mods_tech/slowing_tech_psd.png',
      '/panorama/images/upgrades/mods_tech/soaring_spirit_psd.png',
      '/panorama/images/upgrades/mods_tech/spiritual_dominion_psd.png',
      '/panorama/images/upgrades/mods_tech/spiritual_flow_psd.png',
      '/panorama/images/upgrades/mods_tech/spirit_snatch_psd.png',
      '/panorama/images/upgrades/mods_tech/succor_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_armor_reduction_aura_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_damage_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_duration_extender_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_imbued_bullets_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_range_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_shield_pulse_psd.png',
      '/panorama/images/upgrades/mods_tech/tech_vulnerability_psd.png',
      '/panorama/images/upgrades/mods_tech/torment_aura_psd.png',
    ],
  },
  {
    heroSlug: 'upgrade-mods-utility',
    heroName: 'Utility Mods',
    useFileLabels: true,
    icons: [
      '/panorama/images/upgrades/mods_utility/advanced_recharge_psd.png',
      '/panorama/images/upgrades/mods_utility/base_utility_psd.png',
      '/panorama/images/upgrades/mods_utility/cloaking_device_psd.png',
      '/panorama/images/upgrades/mods_utility/controlled_fall_psd.png',
      '/panorama/images/upgrades/mods_utility/deployable_bullet_shield_psd.png',
      '/panorama/images/upgrades/mods_utility/emp_wave_psd.png',
      '/panorama/images/upgrades/mods_utility/fast_reload_psd.png',
      '/panorama/images/upgrades/mods_utility/fire_rate_aura_psd.png',
      '/panorama/images/upgrades/mods_utility/force_blast_psd.png',
      '/panorama/images/upgrades/mods_utility/health_nova_psd.png',
      '/panorama/images/upgrades/mods_utility/ice_blast_psd.png',
      '/panorama/images/upgrades/mods_utility/life_line_psd.png',
      '/panorama/images/upgrades/mods_utility/preditor_vision_psd.png',
      '/panorama/images/upgrades/mods_utility/smoke_psd.png',
      '/panorama/images/upgrades/mods_utility/springy_boots_psd.png',
      '/panorama/images/upgrades/mods_utility/sprint_booster_psd.png',
      '/panorama/images/upgrades/mods_utility/stasis_psd.png',
      '/panorama/images/upgrades/mods_utility/tech_armor_aura_psd.png',
      '/panorama/images/upgrades/mods_utility/veil_walker_psd.png',
      '/panorama/images/upgrades/mods_utility/zipline_mastery_psd.png',
      '/panorama/images/upgrades/mods_utility/zipline_speed_psd.png',
    ],
  },
  {
    heroSlug: 'upgrade-mods-weapon',
    heroName: 'Weapon Mods',
    useFileLabels: true,
    icons: [
      '/panorama/images/upgrades/mods_weapon/adrenaline_rush_psd.png',
      '/panorama/images/upgrades/mods_weapon/advanced_weaponry_psd.png',
      '/panorama/images/upgrades/mods_weapon/ammo_scavenger_psd.png',
      '/panorama/images/upgrades/mods_weapon/arcane_eater_psd.png',
      '/panorama/images/upgrades/mods_weapon/armor_breaking_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/auto_reloader_psd.png',
      '/panorama/images/upgrades/mods_weapon/banshee_slugs_psd.png',
      '/panorama/images/upgrades/mods_weapon/base_weaponry_psd.png',
      '/panorama/images/upgrades/mods_weapon/berserker_psd.png',
      '/panorama/images/upgrades/mods_weapon/bullet_damage_aura_psd.png',
      '/panorama/images/upgrades/mods_weapon/clip_size_psd.png',
      '/panorama/images/upgrades/mods_weapon/close_range_psd.png',
      '/panorama/images/upgrades/mods_weapon/crit_damage_psd.png',
      '/panorama/images/upgrades/mods_weapon/detention_rounds_psd.png',
      '/panorama/images/upgrades/mods_weapon/electrified_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/emp_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/enhanced_precision_psd.png',
      '/panorama/images/upgrades/mods_weapon/explosive_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/fervor_psd.png',
      '/panorama/images/upgrades/mods_weapon/fire_rate_plus_plus_psd.png',
      '/panorama/images/upgrades/mods_weapon/fire_rate_plus_psd.png',
      '/panorama/images/upgrades/mods_weapon/fire_rate_psd.png',
      '/panorama/images/upgrades/mods_weapon/fleetfoot_boots_psd.png',
      '/panorama/images/upgrades/mods_weapon/glass_cannon_psd.png',
      '/panorama/images/upgrades/mods_weapon/headhunter_psd.png',
      '/panorama/images/upgrades/mods_weapon/headshot_booster_psd.png',
      '/panorama/images/upgrades/mods_weapon/height_advantage_psd.png',
      '/panorama/images/upgrades/mods_weapon/high_velocity_mag_psd.png',
      '/panorama/images/upgrades/mods_weapon/hollow_point_psd.png',
      '/panorama/images/upgrades/mods_weapon/inhibitor_psd.png',
      '/panorama/images/upgrades/mods_weapon/kinetic_sash_psd.png',
      '/panorama/images/upgrades/mods_weapon/lifestrike_gauntlets_psd.png',
      '/panorama/images/upgrades/mods_weapon/longshot_psd.png',
      '/panorama/images/upgrades/mods_weapon/long_range_psd.png',
      '/panorama/images/upgrades/mods_weapon/magic_overflow_psd.png',
      '/panorama/images/upgrades/mods_weapon/medic_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/mega_courage.svg',
      '/panorama/images/upgrades/mods_weapon/melee_charge_psd.png',
      '/panorama/images/upgrades/mods_weapon/piercing_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/point_blank_psd.png',
      '/panorama/images/upgrades/mods_weapon/pristine_emblem_psd.png',
      '/panorama/images/upgrades/mods_weapon/quick_reload_psd.png',
      '/panorama/images/upgrades/mods_weapon/rapid_rounds_psd.png',
      '/panorama/images/upgrades/mods_weapon/reaper_rounds_psd.png',
      '/panorama/images/upgrades/mods_weapon/ricochet_psd.png',
      '/panorama/images/upgrades/mods_weapon/serrated_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/siphon_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/slowing_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/spellslinger_headshots_psd.png',
      '/panorama/images/upgrades/mods_weapon/stabilizer_psd.png',
      '/panorama/images/upgrades/mods_weapon/targeted_silence_psd.png',
      '/panorama/images/upgrades/mods_weapon/tech_resist_shredder_psd.png',
      '/panorama/images/upgrades/mods_weapon/thermal_detonator_psd.png',
      '/panorama/images/upgrades/mods_weapon/titanic_magazine_psd.png',
      '/panorama/images/upgrades/mods_weapon/toxic_bullets_psd.png',
      '/panorama/images/upgrades/mods_weapon/vampiric_burst_psd.png',
      '/panorama/images/upgrades/mods_weapon/warp_stone_psd.png',
    ],
  },
]

const EXTRA_HERO_ABILITY_ICONS: Partial<Record<string, readonly string[]>> = {
  silver: [
    '/panorama/images/hud/abilities/werewolf/5.png',
    '/panorama/images/hud/abilities/werewolf/6.png',
    '/panorama/images/hud/abilities/werewolf/7.png',
  ],
}

function formatBackgroundLabel(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  const rawName = fileName.replace('_bg_psd.png', '')
  const labelOverride = HERO_BACKGROUND_LABEL_OVERRIDES[rawName]

  if (labelOverride) {
    return labelOverride
  }

  return rawName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const HERO_BACKGROUND_OPTIONS: HeroBackgroundOption[] = HERO_BACKGROUND_PATHS.map(path => ({
  label: formatBackgroundLabel(path),
  path,
})).sort((firstOption, secondOption) => {
  if (firstOption.label === 'Generic') {
    return -1
  }

  if (secondOption.label === 'Generic') {
    return 1
  }

  return firstOption.label.localeCompare(secondOption.label)
})

export const HERO_BACKGROUND_GROUPS: EditorAssetGroup[] = [
  {
    id: 'hero-backgrounds',
    label: 'Backgrounds',
    assets: HERO_BACKGROUND_OPTIONS.map(option => ({
      label: option.label,
      path: option.path,
    })),
  },
]

export const ABILITY_ICON_GROUPS: AbilityIconGroup[] = [
  ...HEROES.map(hero => ({
    heroSlug: hero.slug,
    heroName: hero.displayName,
    icons: [
      hero.heroInfo.ability1Icon,
      hero.heroInfo.ability2Icon,
      hero.heroInfo.ability3Icon,
      hero.heroInfo.ability4Icon,
      ...(EXTRA_HERO_ABILITY_ICONS[hero.slug] ?? []),
    ],
  })),
  ...ABILITY_UPGRADE_ICON_GROUPS,
]

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

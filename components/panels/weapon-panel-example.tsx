import WeaponPanel from '@/components/panels/weapon-panel'
import type { PanelStat } from '@/components/panels/scaling-utils'

const EXAMPLE_WEAPON_STATS: PanelStat[] = [
  { label: 'Bullet Damage', value: '3.6', unit: '', icon: 'bulletDamage', scaling: 'none', scalingValue: '0' },
  { label: 'Weapon Damage', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Bullets per sec', value: '1.59', unit: '', icon: 'fireRate', scaling: 'none', scalingValue: '0' },
  { label: 'Fire Rate', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Ammo', value: '9', unit: '', icon: 'ammoClipSize', scaling: 'none', scalingValue: '0' },
  { label: 'Clip Size Increase', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Reload Time', value: '0.35', unit: 's', icon: 'ammoReload', scaling: 'none', scalingValue: '0' },
  { label: 'Reload Reduction', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Velocity', value: '610', unit: 'm/s', icon: 'bulletVelocity', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Velocity Increase', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Lifesteal', value: '0', unit: '%', icon: 'healthStealBullets', scaling: 'none', scalingValue: '0' },
  { label: 'Crit Bonus Scale', value: '0', unit: '%', icon: 'critBonusScale', scaling: 'none', scalingValue: '0' },
  { label: 'Light Melee', value: '50', unit: '', icon: 'melee', scaling: 'none', scalingValue: '0' },
  { label: 'Heavy Melee', value: '116', unit: '', icon: 'melee', scaling: 'none', scalingValue: '0' },
]

export function WeaponPanelExample() {
  return (
    <WeaponPanel
      weaponName="Plasma Rifle"
      weaponDesc="A high-tech energy weapon with controlled recoil and strong range."
      gunImageSrc="/panorama/images/hud/abilities/weapon_damage_psd.png"
      weaponAttributes={['Full Auto', 'Hitscan']}
      bulletDPS={105}
      weaponMinRange={10}
      weaponMaxRange={40}
      weaponStats={EXAMPLE_WEAPON_STATS}
      showSecondaryWeapon
      panelType="weapon"
    />
  )
}

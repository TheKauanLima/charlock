import HeroStatsBoonPanel from '@/components/panels/hero-stats-boon-panel'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import type { PublicHeroDetail } from '@/lib/public-page-types'

import styles from './PublicHero.module.css'

// These panels are client components. Only plain, serializable props are passed:
// no on* handlers, label functions, upload controls, or the full hero definition.
// Variants are stacked below the base panel instead of using PanelVariantTabs.

export default function PublicHeroStatPanels({ hero }: { hero: PublicHeroDetail }) {
  const { boon, weapon, vitality, spirit } = hero.stats

  return (
    <section className={styles.panel} aria-labelledby="public-hero-stats-heading">
      <h2 id="public-hero-stats-heading" className={styles.sectionHeading}>Stats</h2>

      <div className={styles.statGroups}>
        <section className={styles.statGroup} aria-labelledby="public-hero-boon-heading">
          <h3 id="public-hero-boon-heading">Boon</h3>
          <HeroStatsBoonPanel heroName={hero.displayName} panelName={boon.name ?? 'Boon Rewards'} stats={boon.stats} />
          {boon.panels?.map(variant => (
            <div key={variant.id} className={styles.statVariant}>
              <h4>{variant.name}</h4>
              <HeroStatsBoonPanel heroName={hero.displayName} panelName={variant.name} stats={variant.stats} />
            </div>
          ))}
        </section>

        <section className={styles.statGroup} aria-labelledby="public-hero-weapon-heading">
          <h3 id="public-hero-weapon-heading">Weapon</h3>
          <WeaponPanel
            weaponName={weapon.weaponName}
            weaponDesc={weapon.weaponDesc}
            gunImageSrc={weapon.gunImageSrc}
            weaponAttributes={weapon.weaponAttributes}
            weaponStats={weapon.stats}
            bulletDPS={weapon.bulletDPS}
            weaponMinRange={weapon.weaponMinRange}
            weaponMaxRange={weapon.weaponMaxRange}
            showDetails={false}
          />
          {weapon.panels?.map(variant => (
            <div key={variant.id} className={styles.statVariant}>
              <h4>{variant.name}</h4>
              <WeaponPanel
                weaponName={variant.name}
                weaponDesc={variant.weaponDesc ?? weapon.weaponDesc}
                gunImageSrc={variant.gunImageSrc ?? weapon.gunImageSrc}
                weaponAttributes={variant.weaponAttributes ?? weapon.weaponAttributes}
                weaponStats={variant.stats}
                bulletDPS={variant.bulletDPS}
                weaponMinRange={variant.weaponMinRange}
                weaponMaxRange={variant.weaponMaxRange}
                showDetails={false}
              />
            </div>
          ))}
        </section>

        <section className={styles.statGroup} aria-labelledby="public-hero-vitality-heading">
          <h3 id="public-hero-vitality-heading">{vitality.name ?? 'Vitality'}</h3>
          <HeroStatsVitalityPanel stats={vitality.stats} showDetails={false} />
          {vitality.panels?.map(variant => (
            <div key={variant.id} className={styles.statVariant}>
              <h4>{variant.name}</h4>
              <HeroStatsVitalityPanel stats={variant.stats} showDetails={false} />
            </div>
          ))}
        </section>

        <section className={styles.statGroup} aria-labelledby="public-hero-spirit-heading">
          <h3 id="public-hero-spirit-heading">{spirit.name ?? 'Spirit'}</h3>
          <HeroStatsSpiritPanel stats={spirit.topStats} spiritPowerStat={spirit.spiritPowerStat} showDetails={false} />
          {spirit.panels?.map(variant => (
            <div key={variant.id} className={styles.statVariant}>
              <h4>{variant.name}</h4>
              <HeroStatsSpiritPanel stats={variant.topStats} spiritPowerStat={variant.spiritPowerStat} showDetails={false} />
            </div>
          ))}
        </section>
      </div>
    </section>
  )
}

'use client'

import Image from 'next/image'
import type { ChangeEvent } from 'react'

import { buildBoonStatsArray } from '@/components/panels/boon-stats-mapper'
import { formatPanelValue, type PanelStat } from '@/components/panels/scaling-utils'

import styles from './HeroStatsBoonPanel.module.css'

interface HeroStatsBoonPanelProps {
  heroName: string
  stats?: PanelStat[]
  isEditable?: boolean
  onStatsChange?: (stats: PanelStat[]) => void
}

const ICON_PATHS: Record<string, string> = {
  damage_bullet_color: '/panorama/images/icons/properties/damage_bullet_color.svg',
  damage_melee_color: '/panorama/images/icons/properties/damage_melee_color.svg',
  damage_magic_color: '/panorama/images/icons/properties/damage_magic_color.svg',
  health: '/panorama/images/icons/properties/health.svg',
}

export default function HeroStatsBoonPanel({ heroName, stats, isEditable = false, onStatsChange }: HeroStatsBoonPanelProps) {
  const normalizedStats = buildBoonStatsArray(stats)

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === index ? { ...stat, value: event.target.value, scaling: 'boon', scalingValue: event.target.value } : stat
    )))
  }

  return (
    <section className={styles.panel} data-testid="boon-rewards-panel" data-hero-stat-panel="true" aria-label={`${heroName} boon rewards`}>
      <header className={styles.header}>
        <h2 className={styles.title}>Boon Rewards</h2>
        <p className={styles.thresholdCopy}>At each threshold, {heroName} gains:</p>
        <div className={styles.unlockRow}>
          <Image className={styles.unlockIcon} src="/panorama/images/hud/unlock_icon.svg" alt="" width={32} height={32} data-testid="boon-unlock-icon" />
          <span className={styles.orText}>or</span>
          <span className={styles.apIcon} data-testid="boon-ap-icon" aria-hidden="true" />
          <span className={styles.unlockCopy}>
            <strong>Ability Unlock or AP</strong>
            <em>Abilities unlock at Boons 0, 2, 4 and 6</em>
          </span>
        </div>
      </header>

      <div className={styles.rewards}>
        <h3>Stat Increases</h3>
        <p>Rewards max at Boon 35</p>
        <div className={styles.grid}>
          {normalizedStats.map((stat, index) => (
            <div className={styles.stat} key={stat.label}>
              <span className={styles.valueRow}>
                {stat.icon === 'health' ? (
                  <span className={styles.healthIcon} data-testid="boon-base-health-icon" aria-hidden="true" />
                ) : (
                  <Image src={ICON_PATHS[stat.icon ?? '']} alt="" width={23} height={23} />
                )}
                <span aria-hidden="true">+</span>
                {isEditable ? (
                  <input aria-label={`${stat.label} value`} value={stat.value} onChange={event => handleChange(index, event)} />
                ) : (
                  <strong>{formatPanelValue(stat.value)}</strong>
                )}
              </span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

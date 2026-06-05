'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'
import type { SidebarTabId } from '@/components/SidebarTabs/SidebarTabs'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

import styles from './HeroInfoCluster.module.css'

interface HeroInfoClusterProps {
  hero: HeroDefinition
}

const ABILITY_SLOTS = [1, 2, 3, 4] as const

interface HeroStatsState {
  heroSlug: string
  data: HeroStatsPayload
  error: string | null
}

export default function HeroInfoCluster({ hero }: HeroInfoClusterProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId>('overview')
  const fallbackStats = useMemo(() => buildHeroStatsSeed(hero), [hero])
  const [statsState, setStatsState] = useState<HeroStatsState>(() => ({
    heroSlug: hero.slug,
    data: fallbackStats,
    error: null,
  }))
  const statsData = statsState.heroSlug === hero.slug ? statsState.data : fallbackStats
  const heroInfo = statsData.heroInfo ?? hero.heroInfo
  const displayHero = useMemo(() => ({ ...hero, heroInfo }), [hero, heroInfo])

  useEffect(() => {
    const abortController = new AbortController()

    async function loadHeroStats() {
      try {
        const response = await fetch(`/api/heroes/${encodeURIComponent(hero.slug)}/stats`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Hero stats request failed with ${response.status}`)
        }

        const data = (await response.json()) as HeroStatsPayload

        setStatsState({
          heroSlug: hero.slug,
          data,
          error: null,
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setStatsState({
          heroSlug: hero.slug,
          data: fallbackStats,
          error: error instanceof Error ? error.message : 'Failed to load hero stats',
        })
      }
    }

    void loadHeroStats()

    return () => abortController.abort()
  }, [fallbackStats, hero.slug])

  const tags = [
    { text: heroInfo.tag1Text, tilt: heroInfo.tag1Tilt, offsetY: heroInfo.tag1OffsetY },
    { text: heroInfo.tag2Text, tilt: heroInfo.tag2Tilt, offsetY: heroInfo.tag2OffsetY },
    { text: heroInfo.tag3Text, tilt: heroInfo.tag3Tilt, offsetY: heroInfo.tag3OffsetY },
  ]

  const abilities = [heroInfo.ability1Icon, heroInfo.ability2Icon, heroInfo.ability3Icon, heroInfo.ability4Icon]

  return (
    <>
      <aside
        className={styles.cluster}
        data-hero-slug={hero.slug}
        data-testid="hero-info-cluster"
        aria-label={`${hero.displayName} information cluster`}
      >
        <SidebarTabs activeTabId={activeTabId} onSelect={setActiveTabId} />

      {activeTabId === 'overview' ? (
        <div id="hero-panel-overview" role="tabpanel" aria-label={`${hero.displayName} overview`} className={styles.panelContents}>
          <div className={styles.nameRow}>
            {heroInfo.nameType === 'image' ? (
              <span
                className={styles.nameImage}
                data-testid="hero-info-name-image"
                aria-hidden="true"
                style={{
                  '--hero-info-name-color': heroInfo.nameColor,
                  WebkitMaskImage: `url('${heroInfo.nameValue}')`,
                  maskImage: `url('${heroInfo.nameValue}')`,
                } as CSSProperties}
              />
            ) : (
              <span className={styles.nameText} data-testid="hero-info-name-text" style={{ '--hero-info-name-color': heroInfo.nameColor, color: heroInfo.nameColor } as CSSProperties}>
                {heroInfo.nameValue}
              </span>
            )}
          </div>

          <div className={styles.tags} aria-label="Hero tags">
            {tags.map((tag, index) => (
              <span
                key={`${hero.slug}-tag-${index + 1}`}
                className={styles.tag}
                data-testid={`hero-info-tag-${index + 1}`}
                style={{ transform: `translateY(${tag.offsetY}px) rotate(${tag.tilt}deg)`, backgroundColor: heroInfo.tagColor, color: heroInfo.tagTextColor }}
              >
                <span className={styles.tagText}>{tag.text}</span>
              </span>
            ))}
          </div>

          <div className={styles.abilities} aria-label="Hero abilities">
            {ABILITY_SLOTS.map((slot, index) => {
              const icon = abilities[index]

              return (
                <span
                  key={`${hero.slug}-ability-${slot}`}
                  className={styles.ability}
                  data-testid={`hero-info-ability-${slot}`}
                  style={{ '--hero-info-ability-circle-color': heroInfo.abilityCircleColor, backgroundColor: heroInfo.abilityCircleColor, color: heroInfo.abilityCircleColor } as CSSProperties}
                >
                  <span
                    className={styles.abilityIcon}
                    aria-hidden="true"
                    style={{
                      '--hero-info-ability-icon-color': heroInfo.abilityIconColor,
                      backgroundColor: heroInfo.abilityIconColor,
                      WebkitMaskImage: `url('${icon}')`,
                      maskImage: `url('${icon}')`,
                    } as CSSProperties}
                  />
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      <div
        id="hero-panel-weapon"
        role="tabpanel"
        aria-label={`${hero.displayName} weapon stats`}
        hidden={activeTabId !== 'weapon'}
        className={cn(activeTabId === 'weapon' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <WeaponPanel
          weaponName={statsData.weapon.weaponName}
          weaponDesc={statsData.weapon.weaponDesc}
          gunImageSrc={statsData.weapon.gunImageSrc}
          weaponAttributes={statsData.weapon.weaponAttributes}
          weaponStats={statsData.weapon.stats}
          bulletDPS={statsData.weapon.bulletDPS}
          weaponMinRange={statsData.weapon.weaponMinRange}
          weaponMaxRange={statsData.weapon.weaponMaxRange}
        />
      </div>

      <div
        id="hero-panel-vitality"
        role="tabpanel"
        aria-label={`${hero.displayName} vitality stats`}
        hidden={activeTabId !== 'vitality'}
        className={cn(activeTabId === 'vitality' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <HeroStatsVitalityPanel hero={hero} stats={statsData.vitality.stats} />
      </div>

      <div
        id="hero-panel-spirit"
        role="tabpanel"
        aria-label={`${hero.displayName} spirit stats`}
        hidden={activeTabId !== 'spirit'}
        className={cn(activeTabId === 'spirit' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <HeroStatsSpiritPanel hero={hero} stats={statsData.spirit.topStats} spiritPowerStat={statsData.spirit.spiritPowerStat} />
      </div>

        {statsState.error ? <span className="sr-only" role="status">Using fallback hero stats</span> : null}
      </aside>
      <BackstoryModule hero={displayHero} />
    </>
  )
}

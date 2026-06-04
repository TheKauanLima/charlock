'use client'

import { useEffect, useMemo, useState } from 'react'

import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import SidebarTabs from '@/components/sidebar-tabs'
import type { SidebarTabId } from '@/components/sidebar-tabs'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

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
  const { heroInfo } = hero
  const fallbackStats = useMemo(() => buildHeroStatsSeed(hero), [hero])
  const [statsState, setStatsState] = useState<HeroStatsState>(() => ({
    heroSlug: hero.slug,
    data: fallbackStats,
    error: null,
  }))
  const statsData = statsState.heroSlug === hero.slug ? statsState.data : fallbackStats

  useEffect(() => {
    if (activeTabId === 'overview') {
      return undefined
    }

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
  }, [activeTabId, fallbackStats, hero.slug])

  const tags = [
    { text: heroInfo.tag1Text, tilt: heroInfo.tag1Tilt, offsetY: heroInfo.tag1OffsetY },
    { text: heroInfo.tag2Text, tilt: heroInfo.tag2Tilt, offsetY: heroInfo.tag2OffsetY },
    { text: heroInfo.tag3Text, tilt: heroInfo.tag3Tilt, offsetY: heroInfo.tag3OffsetY },
  ]

  const abilities = [heroInfo.ability1Icon, heroInfo.ability2Icon, heroInfo.ability3Icon, heroInfo.ability4Icon]

  return (
    <aside
      className="pointer-events-none absolute right-[clamp(72px,5vw,120px)] bottom-[clamp(36px,4vw,60px)] z-30 flex w-[min(43vw,560px)] select-none flex-col gap-3.5 max-lg:w-[min(52vw,500px)] max-sm:right-3 max-sm:bottom-3 max-sm:w-[min(88vw,380px)]"
      data-hero-slug={hero.slug}
      data-testid="hero-info-cluster"
      aria-label={`${hero.displayName} information cluster`}
    >
      <SidebarTabs activeTabId={activeTabId} onSelect={setActiveTabId} />

      {activeTabId === 'overview' ? (
        <div id="hero-panel-overview" role="tabpanel" aria-label={`${hero.displayName} overview`} className="contents">
          <div className="flex justify-center">
            {heroInfo.nameType === 'image' ? (
              <span
                className="block aspect-[1701/564] w-full bg-[var(--hero-info-name-color)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
                data-testid="hero-info-name-image"
                aria-hidden="true"
                style={{
                  backgroundColor: heroInfo.nameColor,
                  WebkitMaskImage: `url('${heroInfo.nameValue}')`,
                  maskImage: `url('${heroInfo.nameValue}')`,
                }}
              />
            ) : (
              <span className="text-[clamp(1.3rem,2vw,2.7rem)] font-extrabold uppercase tracking-[0.08em]" data-testid="hero-info-name-text" style={{ color: heroInfo.nameColor }}>
                {heroInfo.nameValue}
              </span>
            )}
          </div>

          <div className="mt-3 mb-3 flex flex-nowrap justify-center gap-2.5 max-sm:mb-1 max-sm:gap-1.5" aria-label="Hero tags">
            {tags.map((tag, index) => (
              <span
                key={`${hero.slug}-tag-${index + 1}`}
                className="inline-flex min-h-7 w-fit min-w-0 shrink-0 items-center justify-center px-2 py-[3px] shadow-[0_4px_10px_rgba(0,0,0,0.18)] max-sm:min-h-6 max-sm:px-2.5 max-sm:py-1"
                data-testid={`hero-info-tag-${index + 1}`}
                style={{ transform: `translateY(${tag.offsetY}px) rotate(${tag.tilt}deg)`, backgroundColor: heroInfo.tagColor, color: heroInfo.tagTextColor }}
              >
                <span className="font-['Valve_Pulp',sans-serif] text-[1.4rem] font-black tracking-[0.08em] whitespace-nowrap max-lg:text-[0.84rem] max-sm:text-xs max-sm:tracking-[0.18em]">{tag.text}</span>
              </span>
            ))}
          </div>

          <div className="flex justify-center gap-2.5" aria-label="Hero abilities">
            {ABILITY_SLOTS.map((slot, index) => {
              const icon = abilities[index]

              return (
                <span
                  key={`${hero.slug}-ability-${slot}`}
                  className="inline-flex aspect-square size-[clamp(54px,4.5vw,75px)] shrink-0 items-center justify-center rounded-full bg-transparent shadow-[0_4px_10px_rgba(0,0,0,0.18)] max-sm:size-[34px]"
                  data-testid={`hero-info-ability-${slot}`}
                  style={{ backgroundColor: heroInfo.abilityCircleColor, color: heroInfo.abilityCircleColor }}
                >
                  <span
                    className="size-[68%] bg-[var(--hero-info-ability-icon-color)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
                    aria-hidden="true"
                    style={{
                      backgroundColor: heroInfo.abilityIconColor,
                      WebkitMaskImage: `url('${icon}')`,
                      maskImage: `url('${icon}')`,
                    }}
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
        className={cn(activeTabId === 'weapon' ? 'pointer-events-auto block' : 'hidden')}
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
        className={cn(activeTabId === 'vitality' ? 'pointer-events-auto block' : 'hidden')}
      >
        <HeroStatsVitalityPanel hero={hero} stats={statsData.vitality.stats} />
      </div>

      <div
        id="hero-panel-spirit"
        role="tabpanel"
        aria-label={`${hero.displayName} spirit stats`}
        hidden={activeTabId !== 'spirit'}
        className={cn(activeTabId === 'spirit' ? 'pointer-events-auto block' : 'hidden')}
      >
        <HeroStatsSpiritPanel hero={hero} stats={statsData.spirit.topStats} spiritPowerStat={statsData.spirit.spiritPowerStat} />
      </div>

      {statsState.error ? <span className="sr-only" role="status">Using fallback hero stats</span> : null}
    </aside>
  )
}

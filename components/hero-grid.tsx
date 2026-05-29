'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import HeroInfoCluster from '@/components/hero-info-cluster'
import styles from '@/components/hero-grid.module.css'
import { HEROES } from '@/lib/hero-data'

interface TabItem {
  label: 'Select' | 'Browse' | 'Create'
  disabled?: boolean
}

const TAB_ITEMS: TabItem[] = [
  { label: 'Select' },
  { label: 'Browse', disabled: true },
  { label: 'Create', disabled: true },
]

const GRID_SIZE = 40

export default function HeroGrid() {
  const [activeHeroSlug, setActiveHeroSlug] = useState(HEROES[0]?.slug ?? '')
  const [renderHeroSlug, setRenderHeroSlug] = useState(activeHeroSlug)
  const [pendingRenderHeroSlug, setPendingRenderHeroSlug] = useState<string | null>(null)
  const [renderPhase, setRenderPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle')
  const activeHero = HEROES.find(hero => hero.slug === activeHeroSlug) ?? HEROES[0]
  const renderHero = HEROES.find(hero => hero.slug === renderHeroSlug) ?? activeHero

  useEffect(() => {
    if (renderPhase === 'idle' || !pendingRenderHeroSlug) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      if (renderPhase === 'fade-out') {
        setRenderHeroSlug(pendingRenderHeroSlug)
        setRenderPhase('fade-in')
        return
      }

      setPendingRenderHeroSlug(null)
      setRenderPhase('idle')
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [pendingRenderHeroSlug, renderPhase])

  function handleHeroSelect(heroSlug: string) {
    if (heroSlug === activeHeroSlug) {
      return
    }

    setActiveHeroSlug(heroSlug)
    setPendingRenderHeroSlug(heroSlug)
    setRenderPhase('fade-out')
  }

  return (
    <div className={styles.shell}>
      <div className={styles.backgroundLayer} />
      <div className={styles.smokeLayer} />
      <div className={styles.washLayer} />

      <div className={styles.renderLayer}>
        <div className={styles.renderFade} />
        <div
          key={renderHero.slug}
          className={`${styles.renderFrame} ${renderPhase === 'fade-out' ? styles.renderFrameOutgoing : renderPhase === 'fade-in' ? styles.renderFrameIncoming : ''}`}
          role="img"
          aria-label={`${activeHero.displayName} render`}
          aria-hidden={renderPhase === 'fade-out'}
          style={{ backgroundImage: `url('${renderHero.render}')` }}
        />
      </div>

      <div className={styles.content}>
        <nav aria-label="Hero picker tabs" className={styles.tabs}>
          {TAB_ITEMS.map(tab => {
            const isActive = tab.label === 'Select'

            return (
              <button
                key={tab.label}
                type="button"
                disabled={tab.disabled}
                aria-current={isActive ? 'page' : undefined}
                className={`${styles.tabsButton} ${isActive ? styles.tabsButtonActive : ''} ${tab.disabled ? styles.tabsButtonDisabled : ''}`}
                title={tab.disabled ? 'Coming soon' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <main className={styles.main}>
          <section className={styles.grid}>
            {Array.from({ length: GRID_SIZE }).map((_, index) => {
              const hero = HEROES[index]

              if (!hero) {
                return <div key={`empty-${index}`} data-testid="hero-empty-slot" aria-hidden="true" className={styles.emptySlot} />
              }

              const isSelected = hero.slug === activeHero.slug

              return (
                <button
                  key={hero.slug}
                  type="button"
                  data-testid="hero-card"
                  aria-label={`Select hero ${hero.displayName}`}
                  aria-pressed={isSelected}
                  onClick={() => handleHeroSelect(hero.slug)}
                  className={`${styles.heroCard} ${isSelected ? styles.heroCardActive : ''}`}
                >
                  <span className={styles.heroBacker} />
                  <span className={styles.heroPortraitWrap}>
                    <Image
                      src={hero.portrait}
                      alt={hero.displayName}
                      fill
                      className={`${styles.heroPortrait} ${isSelected ? styles.heroPortraitActive : ''}`}
                      sizes="(max-width: 1024px) 25vw, 12vw"
                    />
                  </span>
                  <span className={styles.heroBorder} />
                  <span className={styles.heroTint} />
                </button>
              )
            })}
          </section>
        </main>
      </div>

      {activeHero ? <HeroInfoCluster hero={activeHero} /> : null}
    </div>
  )
}
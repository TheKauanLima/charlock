'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import HeroInfoEditor from '@/components/HeroInfoEditor/HeroInfoEditor'
import { HERO_BACKGROUND_OPTIONS } from '@/lib/editor-assets'
import type { EditorRenderSelection } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'

import styles from './HeroGrid.module.css'

interface TabItem {
  label: PrimaryTab
  disabled?: boolean
}

type PrimaryTab = 'Select' | 'Browse' | 'Create'

const TAB_ITEMS: TabItem[] = [
  { label: 'Select' },
  { label: 'Browse', disabled: true },
  { label: 'Create' },
]

const GRID_SIZE = 40
const FALLBACK_EDITOR_BACKGROUND = HERO_BACKGROUND_OPTIONS.find(option => option.path.includes('/generic_bg_psd.png'))?.path ?? HERO_BACKGROUND_OPTIONS[0]?.path ?? ''

function cloneHeroInfo(heroInfo: HeroInfoDefinition): HeroInfoDefinition {
  return {
    ...heroInfo,
  }
}

function getEditorBackgroundForHero(hero: HeroDefinition) {
  const assetMatch = HERO_BACKGROUND_OPTIONS.find(option => option.path.endsWith(`/${hero.assetSlug}_bg_psd.png`))
  const slugMatch = HERO_BACKGROUND_OPTIONS.find(option => option.path.endsWith(`/${hero.slug}_bg_psd.png`))

  return assetMatch?.path ?? slugMatch?.path ?? FALLBACK_EDITOR_BACKGROUND
}

export default function HeroGrid() {
  const [activeTab, setActiveTab] = useState<PrimaryTab>('Select')
  const [activeHeroSlug, setActiveHeroSlug] = useState(HEROES[0]?.slug ?? '')
  const [renderHeroSlug, setRenderHeroSlug] = useState(activeHeroSlug)
  const [pendingRenderHeroSlug, setPendingRenderHeroSlug] = useState<string | null>(null)
  const [renderPhase, setRenderPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle')
  const activeHero = HEROES.find(hero => hero.slug === activeHeroSlug) ?? HEROES[0]
  const renderHero = HEROES.find(hero => hero.slug === renderHeroSlug) ?? activeHero
  const [editorDraft, setEditorDraft] = useState<HeroInfoDefinition>(() => cloneHeroInfo(activeHero.heroInfo))
  const [editorBackground, setEditorBackground] = useState(() => getEditorBackgroundForHero(activeHero))
  const [editorRenderSelection, setEditorRenderSelection] = useState<EditorRenderSelection>({ mode: 'background', src: null })
  const isCreateMode = activeTab === 'Create'
  const editorRenderImage = editorRenderSelection.mode === 'hero' && editorRenderSelection.src ? editorRenderSelection.src : editorBackground
  const backstoryHero = useMemo(
    () =>
      isCreateMode
        ? {
            ...activeHero,
            heroInfo: editorDraft,
          }
        : activeHero,
    [activeHero, editorDraft, isCreateMode],
  )

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

    const nextHero = HEROES.find(hero => hero.slug === heroSlug)

    if (nextHero) {
      setEditorDraft(cloneHeroInfo(nextHero.heroInfo))
      setEditorBackground(getEditorBackgroundForHero(nextHero))
      setEditorRenderSelection({ mode: 'background', src: null })
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
          key={isCreateMode ? editorBackground : renderHero.slug}
          className={`${styles.renderFrame} ${renderPhase === 'fade-out' ? styles.renderFrameOutgoing : renderPhase === 'fade-in' ? styles.renderFrameIncoming : ''}`}
          role="img"
          aria-label={isCreateMode ? (editorRenderSelection.mode === 'hero' ? 'Selected editor hero render' : 'Selected editor background') : `${activeHero.displayName} render`}
          aria-hidden={renderPhase === 'fade-out'}
          data-testid="hero-render-layer"
          style={{ backgroundImage: `url('${isCreateMode ? editorRenderImage : renderHero.render}')` }}
        />
        {isCreateMode && editorRenderSelection.mode === 'custom' && editorRenderSelection.src ? (
          <div
            className={styles.renderFrame}
            role="img"
            aria-label="Custom editor hero render"
            data-testid="editor-custom-render-layer"
            style={{ backgroundImage: `url('${editorRenderSelection.src}')` }}
          />
        ) : null}
      </div>

      <div className={styles.content}>
        <nav aria-label="Hero picker tabs" className={styles.tabs}>
          {TAB_ITEMS.map(tab => {
            const isActive = tab.label === activeTab

            return (
              <button
                key={tab.label}
                type="button"
                disabled={tab.disabled}
                aria-current={isActive ? 'page' : undefined}
                className={`${styles.tabsButton} ${isActive ? styles.tabsButtonActive : ''} ${tab.disabled ? styles.tabsButtonDisabled : ''}`}
                title={tab.disabled ? 'Coming soon' : undefined}
                onClick={() => setActiveTab(tab.label)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {!isCreateMode ? (
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
        ) : null}
      </div>

      {isCreateMode ? (
        <HeroInfoEditor
          hero={activeHero}
          draft={editorDraft}
          backgroundOptions={HERO_BACKGROUND_OPTIONS}
          selectedBackground={editorBackground}
          renderSelection={editorRenderSelection}
          onBackgroundChange={setEditorBackground}
          onRenderSelectionChange={setEditorRenderSelection}
          onDraftChange={setEditorDraft}
        />
      ) : (
        <HeroInfoCluster hero={activeHero} />
      )}

      {isCreateMode ? <BackstoryModule hero={backstoryHero} /> : null}
    </div>
  )
}

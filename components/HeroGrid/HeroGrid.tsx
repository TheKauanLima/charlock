'use client'

import { Heart } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import HeroInfoEditor from '@/components/HeroInfoEditor/HeroInfoEditor'
import { HERO_BACKGROUND_OPTIONS } from '@/lib/editor-assets'
import type { EditorRenderSelection } from '@/lib/editor-assets'
import { buildDefaultAbilityStats, type AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { CustomHeroDetail, CustomHeroSavePayload, CustomHeroSort, CustomHeroSummary } from '@/lib/custom-hero-types'
import { HEROES } from '@/lib/hero-data'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import { HERO_TEMPLATES, type HeroTemplateDefinition } from '@/templates'

import styles from './HeroGrid.module.css'

interface TabItem {
  label: PrimaryTab
  disabled?: boolean
}

type PrimaryTab = 'Select' | 'Browse' | 'Bookmarks' | 'Create'

interface HeroGridProps {
  initialTab?: PrimaryTab
}

const TAB_ITEMS: TabItem[] = [
  { label: 'Select' },
  { label: 'Browse' },
  { label: 'Bookmarks' },
  { label: 'Create' },
]

const GRID_SIZE = 40
const BROWSE_PAGE_SIZE = 24
const FALLBACK_EDITOR_BACKGROUND = HERO_BACKGROUND_OPTIONS.find(option => option.path.includes('/generic_bg_psd.png'))?.path ?? HERO_BACKGROUND_OPTIONS[0]?.path ?? ''
const SHOW_DETAILS_STORAGE_KEY = 'charlock_show_details'

function getStoredShowDetails() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(SHOW_DETAILS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

interface ActivityFeedItem {
  id: string
  type: 'published_hero' | 'comment'
  createdAt: string
  heroId: string
  heroName: string
  heroPortrait: string
  actorName: string
  content?: string
}

interface BrowsePagination {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

interface HeroStatsWithAbilityPayload extends HeroStatsPayload {
  abilityStats?: AbilityStatsPayload
}

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

function getSavedRenderSelection(renderPath: string): { background: string; renderSelection: EditorRenderSelection } {
  if (HERO_BACKGROUND_OPTIONS.some(option => option.path === renderPath)) {
    return {
      background: renderPath,
      renderSelection: { mode: 'background', src: null },
    }
  }

  if (renderPath.startsWith('/render/')) {
    return {
      background: FALLBACK_EDITOR_BACKGROUND,
      renderSelection: { mode: 'hero', src: renderPath },
    }
  }

  return {
    background: FALLBACK_EDITOR_BACKGROUND,
    renderSelection: { mode: 'custom', src: renderPath },
  }
}

function getHeroResponseError(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error
  }

  return fallback
}

function mergeSubmittedSecondaryAbilities(savedAbilityStats: AbilityStatsPayload, submittedAbilityStats: AbilityStatsPayload): AbilityStatsPayload {
  if (!submittedAbilityStats.secondaryAbilities || savedAbilityStats.secondaryAbilities) {
    return savedAbilityStats
  }

  return {
    ...savedAbilityStats,
    secondaryAbilities: submittedAbilityStats.secondaryAbilities,
    secondaryAbilityAnchorIndex: submittedAbilityStats.secondaryAbilityAnchorIndex,
  }
}

export default function HeroGrid({ initialTab = 'Select' }: HeroGridProps) {
  const [activeTab, setActiveTab] = useState<PrimaryTab>(initialTab)
  const [browseSort, setBrowseSort] = useState<CustomHeroSort>('new')
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseHeroes, setBrowseHeroes] = useState<CustomHeroSummary[]>([])
  const [browsePagination, setBrowsePagination] = useState<BrowsePagination | null>(null)
  const [isBrowseLoadingMore, setIsBrowseLoadingMore] = useState(false)
  const [selectedBrowseHeroId, setSelectedBrowseHeroId] = useState<string | null>(null)
  const [browseStatus, setBrowseStatus] = useState<string | null>(null)
  const [feedItems, setFeedItems] = useState<ActivityFeedItem[]>([])
  const [feedStatus, setFeedStatus] = useState<string | null>(null)
  const [activeHeroSlug, setActiveHeroSlug] = useState(HEROES[0]?.slug ?? '')
  const [renderHeroSlug, setRenderHeroSlug] = useState(activeHeroSlug)
  const [pendingRenderHeroSlug, setPendingRenderHeroSlug] = useState<string | null>(null)
  const [renderPhase, setRenderPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle')
  const [editingCustomHero, setEditingCustomHero] = useState<CustomHeroSummary | null>(null)
  const [templateHero, setTemplateHero] = useState<CustomHeroSummary | null>(null)
  const [editingHeroStats, setEditingHeroStats] = useState<HeroStatsPayload | null>(null)
  const [editingAbilityStats, setEditingAbilityStats] = useState<AbilityStatsPayload | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowDetails(getStoredShowDetails()), 0)

    return () => window.clearTimeout(timeoutId)
  }, [])
  const [isSavingHero, setIsSavingHero] = useState(false)
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null)
  const activeHero = HEROES.find(hero => hero.slug === activeHeroSlug) ?? HEROES[0]
  const renderHero = HEROES.find(hero => hero.slug === renderHeroSlug) ?? activeHero
  const editorHero = editingCustomHero ?? templateHero ?? activeHero
  const selectedBrowseHero = useMemo(
    () => browseHeroes.find(hero => hero.id === selectedBrowseHeroId) ?? browseHeroes[0] ?? null,
    [browseHeroes, selectedBrowseHeroId],
  )
  const [editorDraft, setEditorDraft] = useState<HeroInfoDefinition>(() => cloneHeroInfo(activeHero.heroInfo))
  const [editorBackground, setEditorBackground] = useState(() => getEditorBackgroundForHero(activeHero))
  const [editorRenderSelection, setEditorRenderSelection] = useState<EditorRenderSelection>({ mode: 'background', src: null })
  const isCreateMode = activeTab === 'Create'
  const editorRenderImage = editorRenderSelection.mode === 'hero' && editorRenderSelection.src ? editorRenderSelection.src : editorBackground
  const displayRenderImage = isCreateMode ? editorRenderImage : activeTab === 'Browse' && selectedBrowseHero ? selectedBrowseHero.render : renderHero.render
  const displayRenderLabel = isCreateMode
    ? (editorRenderSelection.mode === 'hero' ? 'Selected editor hero render' : 'Selected editor background')
    : activeTab === 'Browse' && selectedBrowseHero
      ? `${selectedBrowseHero.displayName} render`
      : `${activeHero.displayName} render`
  const backstoryHero = useMemo(
    () =>
      isCreateMode
        ? {
            ...editorHero,
            heroInfo: editorDraft,
          }
        : activeHero,
    [activeHero, editorDraft, editorHero, isCreateMode],
  )

  const applySavedHeroToEditor = useCallback((hero: CustomHeroDetail) => {
    const renderState = getSavedRenderSelection(hero.render)

    setEditingCustomHero(hero)
    setTemplateHero(null)
    setEditingHeroStats(hero.stats)
    setEditingAbilityStats(hero.abilityStats)
    setEditorDraft(cloneHeroInfo(hero.heroInfo))
    setEditorBackground(hero.background || renderState.background)
    setEditorRenderSelection(renderState.renderSelection)
    setEditorRevision(currentRevision => currentRevision + 1)
    setActiveTab('Create')
  }, [])

  const applyTemplateHeroToEditor = useCallback((hero: CustomHeroDetail) => {
    const renderState = getSavedRenderSelection(hero.render)

    setEditingCustomHero(null)
    setTemplateHero({
      ...hero,
      id: `template-${hero.id}`,
      displayName: `${hero.displayName} Copy`,
      status: 'private',
      allowCopies: false,
      viewerCanEdit: false,
    })
    setEditingHeroStats(hero.stats)
    setEditingAbilityStats(hero.abilityStats)
    setEditorDraft(cloneHeroInfo(hero.heroInfo))
    setEditorBackground(hero.background || renderState.background)
    setEditorRenderSelection(renderState.renderSelection)
    setEditorRevision(currentRevision => currentRevision + 1)
    setActiveTab('Create')
    setSaveStatusMessage('Template loaded as a new draft.')
  }, [])

  const applyOfficialHeroToEditor = useCallback((hero: HeroDefinition, stats: HeroStatsPayload, abilityStats: AbilityStatsPayload) => {
    const renderState = getSavedRenderSelection(hero.render)
    const heroInfo = cloneHeroInfo(stats.heroInfo ?? hero.heroInfo)
    const timestamp = new Date().toISOString()

    setEditingCustomHero(null)
    setTemplateHero({
      ...hero,
      id: `official-template-${hero.slug}`,
      creatorId: 'template',
      status: 'private',
      likesCount: 0,
      likedByCurrentUser: false,
      bookmarkedByCurrentUser: false,
      allowCopies: false,
      background: getEditorBackgroundForHero(hero),
      viewerCanEdit: false,
      abilityStats,
      publishedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    setEditingHeroStats({
      ...stats,
      heroInfo,
    })
    setEditingAbilityStats(abilityStats)
    setEditorDraft(heroInfo)
    setEditorBackground(getEditorBackgroundForHero(hero))
    setEditorRenderSelection(renderState.renderSelection)
    setEditorRevision(currentRevision => currentRevision + 1)
    setActiveTab('Create')
  }, [])

  const startCreateFromTemplate = useCallback((template: HeroTemplateDefinition) => {
    const hero = template.hero
    const renderState = getSavedRenderSelection(hero.render)

    setEditingCustomHero(null)
    setTemplateHero(hero)
    setEditingHeroStats(hero.stats)
    setEditingAbilityStats(hero.abilityStats)
    setEditorDraft(cloneHeroInfo(hero.heroInfo))
    setEditorBackground(hero.background || renderState.background)
    setEditorRenderSelection(renderState.renderSelection)
    setEditorRevision(currentRevision => currentRevision + 1)
    setActiveTab('Create')
    setIsTemplateModalOpen(false)
    setSaveStatusMessage(`${template.label} template loaded.`)
  }, [])

  const loadSavedHero = useCallback(async (heroId: string) => {
    await Promise.resolve()

    try {
      setSaveStatusMessage('Loading saved hero...')

      const response = await fetch(`/api/heroes?id=${encodeURIComponent(heroId)}`)
      const body = await response.json() as { hero?: CustomHeroDetail; error?: string }

      if (!response.ok || !body.hero) {
        throw new Error(getHeroResponseError(body, `Saved hero request failed with ${response.status}`))
      }

      applySavedHeroToEditor(body.hero)
      setSaveStatusMessage('Saved hero loaded.')
    } catch (error) {
      setSaveStatusMessage(error instanceof Error ? error.message : 'Failed to load saved hero.')
    }
  }, [applySavedHeroToEditor])

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const searchParams = new URLSearchParams(window.location.search)
    const heroId = searchParams.get('heroId')
    const requestedTab = searchParams.get('tab')

    if (heroId && requestedTab !== 'browse') {
      const timeoutId = window.setTimeout(() => {
        void loadSavedHero(heroId)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [loadSavedHero])

  const getBrowseUrl = useCallback((offset: number) => {
    const searchParams = new URLSearchParams({
      status: 'published',
      sort: browseSort,
      limit: String(BROWSE_PAGE_SIZE),
      offset: String(offset),
    })
    const trimmedSearch = browseSearch.trim()

    if (trimmedSearch) {
      searchParams.set('search', trimmedSearch)
    }

    return `/api/heroes?${searchParams.toString()}`
  }, [browseSearch, browseSort])

  useEffect(() => {
    if (activeTab !== 'Browse') {
      return undefined
    }

    const abortController = new AbortController()

    async function loadBrowseHeroes() {
      setBrowseStatus('Loading characters...')

      try {
        const response = await fetch(getBrowseUrl(0), {
          signal: abortController.signal,
        })
        const body = await response.json() as { heroes?: CustomHeroSummary[]; pagination?: BrowsePagination; error?: string }

        if (!response.ok) {
          throw new Error(getHeroResponseError(body, `Browse request failed with ${response.status}`))
        }

        const nextHeroes = body.heroes ?? []

        const requestedHeroId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('heroId')

        setBrowseHeroes(nextHeroes)
        setBrowsePagination(body.pagination ?? null)
        setSelectedBrowseHeroId(currentId => {
          if (requestedHeroId && nextHeroes.some(hero => hero.id === requestedHeroId)) {
            return requestedHeroId
          }

          return currentId && nextHeroes.some(hero => hero.id === currentId) ? currentId : nextHeroes[0]?.id ?? null
        })
        setBrowseStatus(nextHeroes.length ? null : 'No published characters match your search.')
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setBrowseStatus(error instanceof Error ? error.message : 'Failed to load characters.')
      }
    }

    void loadBrowseHeroes()

    return () => abortController.abort()
  }, [activeTab, getBrowseUrl])

  useEffect(() => {
    if (activeTab !== 'Bookmarks') {
      return undefined
    }

    const abortController = new AbortController()

    async function loadActivityFeed() {
      setFeedStatus('Loading activity feed...')

      try {
        const response = await fetch('/api/feed', {
          signal: abortController.signal,
        })
        const body = await response.json() as { items?: ActivityFeedItem[]; error?: string }

        if (!response.ok) {
          throw new Error(getHeroResponseError(body, `Activity feed request failed with ${response.status}`))
        }

        const nextItems = body.items ?? []

        setFeedItems(nextItems)
        setFeedStatus(nextItems.length ? null : 'No activity yet.')
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setFeedStatus(error instanceof Error ? error.message : 'Failed to load activity feed.')
      }
    }

    void loadActivityFeed()

    return () => abortController.abort()
  }, [activeTab])

  function handleHeroSelect(heroSlug: string) {
    if (heroSlug === activeHeroSlug) {
      return
    }

    const nextHero = HEROES.find(hero => hero.slug === heroSlug)

    if (nextHero) {
      setEditingCustomHero(null)
      setTemplateHero(null)
      setEditingHeroStats(null)
      setEditingAbilityStats(null)
      setSaveStatusMessage(null)
      setEditorDraft(cloneHeroInfo(nextHero.heroInfo))
      setEditorBackground(getEditorBackgroundForHero(nextHero))
      setEditorRenderSelection({ mode: 'background', src: null })
    }

    setActiveHeroSlug(heroSlug)
    setPendingRenderHeroSlug(heroSlug)
    setRenderPhase('fade-out')
  }

  async function handleSaveHero(payload: CustomHeroSavePayload) {
    setIsSavingHero(true)
    setSaveStatusMessage(payload.status === 'published' ? 'Publishing hero...' : 'Saving private hero...')

    try {
      const response = await fetch('/api/heroes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json() as { hero?: CustomHeroDetail; error?: string }

      if (!response.ok || !body.hero) {
        throw new Error(getHeroResponseError(body, `Save request failed with ${response.status}`))
      }

      applySavedHeroToEditor({
        ...body.hero,
        abilityStats: mergeSubmittedSecondaryAbilities(body.hero.abilityStats, payload.abilityStats),
      })
      setSaveStatusMessage(body.hero.status === 'published' ? 'Hero published to Browse.' : 'Private hero saved to your profile.')
    } catch (error) {
      setSaveStatusMessage(error instanceof Error ? error.message : 'Failed to save hero.')
    } finally {
      setIsSavingHero(false)
    }
  }

  async function handleLikeHero(heroId: string) {
    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json() as { hero?: CustomHeroSummary; error?: string }

      if (!response.ok || !body.hero) {
        throw new Error(getHeroResponseError(body, `Like request failed with ${response.status}`))
      }

      setBrowseHeroes(currentHeroes => currentHeroes.map(hero => (hero.id === body.hero?.id ? body.hero : hero)))
    } catch (error) {
      setBrowseStatus(error instanceof Error ? error.message : 'Failed to like hero.')
    }
  }

  async function handleLoadMoreBrowseHeroes() {
    if (!browsePagination?.hasMore || isBrowseLoadingMore) {
      return
    }

    setIsBrowseLoadingMore(true)

    try {
      const response = await fetch(getBrowseUrl(browseHeroes.length))
      const body = await response.json() as { heroes?: CustomHeroSummary[]; pagination?: BrowsePagination; error?: string }

      if (!response.ok) {
        throw new Error(getHeroResponseError(body, `Browse request failed with ${response.status}`))
      }

      const nextHeroes = body.heroes ?? []

      setBrowseHeroes(currentHeroes => [...currentHeroes, ...nextHeroes.filter(nextHero => !currentHeroes.some(currentHero => currentHero.id === nextHero.id))])
      setBrowsePagination(body.pagination ?? null)
      setBrowseStatus(null)
    } catch (error) {
      setBrowseStatus(error instanceof Error ? error.message : 'Failed to load more characters.')
    } finally {
      setIsBrowseLoadingMore(false)
    }
  }

  async function recordTemplateCopy(heroId: string) {
    try {
      await fetch(`/api/heroes/${encodeURIComponent(heroId)}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch {
      // Copy tracking should not block a user from starting a new draft.
    }
  }

  async function handleUseTemplate(heroId: string) {
    try {
      setBrowseStatus('Loading template...')

      const response = await fetch(`/api/heroes?id=${encodeURIComponent(heroId)}`)
      const body = await response.json() as { hero?: CustomHeroDetail; error?: string }

      if (!response.ok || !body.hero) {
        throw new Error(getHeroResponseError(body, `Template request failed with ${response.status}`))
      }

      applyTemplateHeroToEditor(body.hero)
      void recordTemplateCopy(heroId)
      setBrowseStatus(null)
    } catch (error) {
      setBrowseStatus(error instanceof Error ? error.message : 'Failed to load template.')
    }
  }

  async function handleCreateFromSelectedHero(hero: HeroDefinition) {
    const fallbackStats = buildHeroStatsSeed(hero)
    const fallbackAbilityStats = buildDefaultAbilityStats(hero)

    applyOfficialHeroToEditor(hero, fallbackStats, fallbackAbilityStats)
    setSaveStatusMessage(`Loading ${hero.displayName} stats...`)

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(hero.slug)}/stats`)
      const body = await response.json() as Partial<HeroStatsWithAbilityPayload>

      if (!response.ok) {
        throw new Error(getHeroResponseError(body, `Hero stats request failed with ${response.status}`))
      }

      const nextStats: HeroStatsPayload = {
        hero: body.hero ?? fallbackStats.hero,
        heroInfo: body.heroInfo ?? fallbackStats.heroInfo,
        weapon: body.weapon ?? fallbackStats.weapon,
        vitality: body.vitality ?? fallbackStats.vitality,
        spirit: body.spirit ?? fallbackStats.spirit,
      }
      const nextHeroInfo = nextStats.heroInfo ?? hero.heroInfo
      const nextAbilityStats = body.abilityStats ?? buildDefaultAbilityStats({ ...hero, heroInfo: nextHeroInfo })

      applyOfficialHeroToEditor(hero, nextStats, nextAbilityStats)
      setSaveStatusMessage(`${hero.displayName} loaded as a new draft.`)
    } catch (error) {
      setSaveStatusMessage(error instanceof Error ? `${hero.displayName} loaded with fallback stats. ${error.message}` : `${hero.displayName} loaded with fallback stats.`)
    }
  }

  function handleTabSelect(tab: PrimaryTab) {
    if (tab === 'Create') {
      setIsTemplateModalOpen(true)
      return
    }

    setActiveTab(tab)
  }

  function handleTemplateSelect(template: HeroTemplateDefinition) {
    if (!template.available) {
      return
    }

    startCreateFromTemplate(template)
  }

  function handleShowDetailsToggle() {
    setShowDetails(current => {
      const nextValue = !current

      try {
        window.localStorage.setItem(SHOW_DETAILS_STORAGE_KEY, String(nextValue))
      } catch {
        // Keep the in-memory preference even if storage is unavailable.
      }

      return nextValue
    })
  }

  return (
    <div className={styles.shell}>
      <div className={styles.backgroundLayer} />
      <div className={styles.smokeLayer} />
      <div className={styles.washLayer} />

      <div className={styles.renderLayer}>
        <div className={styles.renderFade} />
        <div
          key={isCreateMode ? editorBackground : activeTab === 'Browse' ? selectedBrowseHero?.id ?? 'browse-empty' : renderHero.slug}
          className={`${styles.renderFrame} ${renderPhase === 'fade-out' ? styles.renderFrameOutgoing : renderPhase === 'fade-in' ? styles.renderFrameIncoming : ''}`}
          role="img"
          aria-label={displayRenderLabel}
          aria-hidden={renderPhase === 'fade-out'}
          data-testid="hero-render-layer"
          style={{ backgroundImage: `url('${displayRenderImage}')` }}
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
                onClick={() => handleTabSelect(tab.label)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {activeTab === 'Browse' ? (
          <div className={styles.browseTools}>
            <label className={styles.searchField} htmlFor="browse-hero-search">
              <span>Search</span>
              <input
                id="browse-hero-search"
                type="search"
                value={browseSearch}
                onChange={event => setBrowseSearch(event.target.value)}
                placeholder="Find characters"
              />
            </label>
            <nav className={styles.browseNav} aria-label="Browse categories">
              {[
                { id: 'new', label: 'New' },
                { id: 'liked', label: 'Most Liked' },
                { id: 'trending', label: 'Trending' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.browseNavButton} ${browseSort === item.id ? styles.browseNavButtonActive : ''}`}
                  aria-pressed={browseSort === item.id}
                  onClick={() => setBrowseSort(item.id as CustomHeroSort)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        ) : null}

        {activeTab === 'Browse' && selectedBrowseHero ? (
          <div className={styles.browseHeroActions}>
            {selectedBrowseHero.viewerCanEdit ? (
              <button type="button" onClick={() => loadSavedHero(selectedBrowseHero.id)}>
                Edit Hero
              </button>
            ) : null}
            {!selectedBrowseHero.viewerCanEdit && selectedBrowseHero.allowCopies ? (
              <button type="button" onClick={() => handleUseTemplate(selectedBrowseHero.id)}>
                Use as Template
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'Bookmarks' ? (
          <main className={styles.activityMain}>
            {feedStatus ? <p className={styles.browseStatus} role="status">{feedStatus}</p> : null}
            <section className={styles.activityFeed} aria-label="Activity feed">
              {feedItems.map(item => (
                <article key={item.id} className={styles.activityItem}>
                  <span className={styles.activityPortrait}>
                    <Image src={item.heroPortrait} alt="" fill sizes="72px" />
                  </span>
                  <div>
                    <p>{item.type === 'published_hero' ? 'New Publication' : 'Comment'}</p>
                    <h2>{item.heroName}</h2>
                    <span>{item.actorName}</span>
                    {item.content ? <q>{item.content}</q> : null}
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}
                    </time>
                  </div>
                </article>
              ))}
            </section>
          </main>
        ) : !isCreateMode ? (
          <main className={`${styles.main} ${activeTab === 'Browse' ? styles.browseMain : ''}`}>
            <button
              type="button"
              className={`${styles.detailsToggle} ${showDetails ? styles.detailsToggleActive : ''}`}
              aria-label={showDetails ? 'Hide Details' : 'Show Details'}
              aria-pressed={showDetails}
              title={showDetails ? 'Hide scaling values' : 'Show scaling values'}
              onClick={handleShowDetailsToggle}
            >
              <span aria-hidden="true" />
            </button>
            {activeTab === 'Browse' && browseStatus ? <p className={styles.browseStatus} role="status">{browseStatus}</p> : null}
            <section className={styles.grid}>
              {Array.from({ length: activeTab === 'Browse' ? Math.max(GRID_SIZE, browseHeroes.length) : GRID_SIZE }).map((_, index) => {
                if (activeTab === 'Browse') {
                  const hero = browseHeroes[index]

                  if (!hero) {
                    return <div key={`empty-${index}`} data-testid="hero-empty-slot" aria-hidden="true" className={styles.emptySlot} />
                  }

                  const isSelected = hero.id === selectedBrowseHero?.id

                  return (
                    <article key={hero.id} className={styles.browseCard}>
                      <button
                        type="button"
                        data-testid="hero-card"
                        aria-label={`Select character ${hero.displayName}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedBrowseHeroId(hero.id)}
                        className={`${styles.heroCard} ${isSelected ? styles.heroCardActive : ''}`}
                      >
                        <span className={styles.heroBacker} />
                        <span className={styles.browseBackground} data-testid="browse-card-background" style={{ backgroundImage: `url('${hero.background}')` }} aria-hidden="true" />
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
                      <button
                        type="button"
                        className={`${styles.likeButton} ${hero.likedByCurrentUser ? styles.likeButtonActive : ''}`}
                        aria-label={`${hero.likedByCurrentUser ? 'Unlike' : 'Like'} ${hero.displayName}`}
                        onClick={() => handleLikeHero(hero.id)}
                      >
                        <Heart aria-hidden="true" />
                        <span>{hero.likesCount}</span>
                      </button>
                    </article>
                  )
                }

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
                    aria-label={`Select character ${hero.displayName}`}
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
            {activeTab === 'Browse' && browsePagination?.hasMore ? (
              <button type="button" className={styles.loadMoreButton} onClick={handleLoadMoreBrowseHeroes} disabled={isBrowseLoadingMore}>
                {isBrowseLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            ) : null}
          </main>
        ) : null}
      </div>

      {isCreateMode ? (
        <HeroInfoEditor
          key={`${editingCustomHero ? `${editingCustomHero.id}:${editingCustomHero.displayName}` : templateHero ? templateHero.id : activeHero.slug}:${editorRevision}`}
          hero={editorHero}
          draft={editorDraft}
          backgroundOptions={HERO_BACKGROUND_OPTIONS}
          selectedBackground={editorBackground}
          renderSelection={editorRenderSelection}
          savedHeroId={editingCustomHero?.id ?? null}
          savedHeroName={editingCustomHero?.displayName ?? ''}
          allowCopies={editingCustomHero?.allowCopies ?? false}
          initialStats={editingHeroStats}
          initialAbilityStats={editingAbilityStats}
          isSaving={isSavingHero}
          saveStatusMessage={saveStatusMessage}
          onBackgroundChange={setEditorBackground}
          onRenderSelectionChange={setEditorRenderSelection}
          onDraftChange={setEditorDraft}
          onSaveHero={handleSaveHero}
        />
      ) : activeTab === 'Browse' ? (
        selectedBrowseHero ? <HeroInfoCluster hero={selectedBrowseHero} showDetails={showDetails} /> : null
      ) : activeTab === 'Bookmarks' ? (
        null
      ) : (
        <HeroInfoCluster hero={activeHero} showDetails={showDetails} onCreateFromHero={() => void handleCreateFromSelectedHero(activeHero)} />
      )}

      {isCreateMode ? (
        <BackstoryModule
          hero={backstoryHero}
          isEditable
          onBackstoryChange={value => setEditorDraft(currentDraft => ({ ...currentDraft, backstory: value }))}
        />
      ) : null}

      {isTemplateModalOpen ? (
        <div className={styles.templateModalBackdrop}>
          <section
            className={styles.templateModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-picker-title"
          >
            <header className={styles.templateModalHeader}>
              <div>
                <p>CREATE CHARACTER</p>
                <h2 id="template-picker-title">Choose Template</h2>
              </div>
              <button
                type="button"
                className={styles.templateModalClose}
                aria-label="Close template picker"
                onClick={() => setIsTemplateModalOpen(false)}
              >
                x
              </button>
            </header>
            <div className={styles.templateGrid}>
              {HERO_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`${styles.templateCard} ${template.available ? styles.templateCardAvailable : styles.templateCardLocked}`}
                  disabled={!template.available}
                  aria-label={template.available ? `Use ${template.label} template` : `${template.label} template not available`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <span className={styles.templateName}>{template.label}</span>
                  {template.available ? (
                    <span className={styles.templateStatusAvailable}>Available</span>
                  ) : (
                    <span className={styles.templateStatusLocked}>Not available</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

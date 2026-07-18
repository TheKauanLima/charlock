'use client'

import { Heart } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import HeroInfoEditor from '@/components/HeroInfoEditor/HeroInfoEditor'
import { ConnectionStatus, LoadingOverlay, SessionExpiredModal } from '@/components/system-feedback/SystemFeedback'
import { HERO_BACKGROUND_OPTIONS } from '@/lib/editor-assets'
import type { EditorRenderSelection, RenderPosition } from '@/lib/editor-assets'
import { buildDefaultAbilityStats, type AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { CustomHeroDetail, CustomHeroSavePayload, CustomHeroSort, CustomHeroSummary } from '@/lib/custom-hero-types'
import { getNetworkRequestError, getUserFacingSaveError, parseClientRequestError, readApiResponse, type ApiErrorPayload } from '@/lib/client-errors'
import { clearEditorRecovery } from '@/lib/editor-recovery'
import { HEROES } from '@/lib/hero-data'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { getThumbnailUrl, IMAGE_BLUR_DATA_URL } from '@/lib/image-optimization'
import { HERO_TEMPLATES, type HeroTemplateDefinition } from '@/templates'

import styles from './HeroGrid.module.css'

interface TabItem {
  label: PrimaryTab
  disabled?: boolean
}

type PrimaryTab = 'Select' | 'Browse' | 'Bookmarks' | 'Notifications' | 'Create'

interface HeroGridProps {
  initialTab?: PrimaryTab
}

interface RenderDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startPosition: RenderPosition
}

const TAB_ITEMS: TabItem[] = [
  { label: 'Select' },
  { label: 'Browse' },
  { label: 'Create' },
]

const GRID_SIZE = 40
const INITIAL_BROWSE_PAGE_SIZE = 24
const NEXT_BROWSE_PAGE_SIZE = 12
const FALLBACK_EDITOR_BACKGROUND = HERO_BACKGROUND_OPTIONS.find(option => option.path.includes('/generic_bg_psd.png'))?.path ?? HERO_BACKGROUND_OPTIONS[0]?.path ?? ''
const SHOW_DETAILS_STORAGE_KEY = 'charlock_show_details'
const RENDER_POSITION_LIMIT = 2000
const HERO_BACKGROUND_SLUG_OVERRIDES: Record<string, string> = {
  ladygeist: 'geist',
}

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
  const displayNameSlug = hero.displayName
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const backgroundSlugs = [
    hero.assetSlug,
    hero.slug,
    displayNameSlug,
    HERO_BACKGROUND_SLUG_OVERRIDES[hero.slug],
  ].filter((slug): slug is string => Boolean(slug))
  const backgroundMatch = HERO_BACKGROUND_OPTIONS.find(option =>
    backgroundSlugs.some(backgroundSlug => option.path.endsWith(`/${backgroundSlug}_bg_psd.png`)),
  )

  return backgroundMatch?.path ?? FALLBACK_EDITOR_BACKGROUND
}

function clampRenderOffset(value: number) {
  return Math.min(RENDER_POSITION_LIMIT, Math.max(-RENDER_POSITION_LIMIT, Math.round(value)))
}

function normalizeRenderPosition(position: RenderPosition | null | undefined): RenderPosition {
  return {
    x: clampRenderOffset(position?.x ?? 0),
    y: clampRenderOffset(position?.y ?? 0),
  }
}

function normalizeRenderSelection(renderSelection: EditorRenderSelection): EditorRenderSelection {
  if (renderSelection.mode === 'background' || !renderSelection.src) {
    return { mode: 'background', src: null }
  }

  return {
    ...renderSelection,
    position: normalizeRenderPosition(renderSelection.position),
  }
}

function getRenderBackgroundPosition(position: RenderPosition | null | undefined) {
  const normalizedPosition = normalizeRenderPosition(position)

  return `calc(100% + ${normalizedPosition.x}px) calc(0% + ${normalizedPosition.y}px)`
}

function isBackgroundRenderPath(path: string) {
  return HERO_BACKGROUND_OPTIONS.some(option => option.path === path)
}

function isPresetRenderPath(path: string) {
  return path.startsWith('/render/')
}

function isCustomRenderPath(path: string) {
  return Boolean(path) && !isBackgroundRenderPath(path) && !isPresetRenderPath(path)
}

function shouldIgnoreRenderDragTarget(target: EventTarget | null) {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null

  return Boolean(element?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="dialog"], [role="textbox"], [data-hero-stat-panel="true"], [data-testid="ability-editor"], [data-testid="primary-top-bar"]'))
}

function getSavedRenderSelection(renderPath: string, renderPosition?: RenderPosition): { background: string; renderSelection: EditorRenderSelection } {
  if (isBackgroundRenderPath(renderPath)) {
    return {
      background: renderPath,
      renderSelection: { mode: 'background', src: null },
    }
  }

  if (renderPath.startsWith('/render/')) {
    return {
      background: FALLBACK_EDITOR_BACKGROUND,
      renderSelection: { mode: 'hero', src: renderPath, position: normalizeRenderPosition(renderPosition) },
    }
  }

  return {
    background: FALLBACK_EDITOR_BACKGROUND,
    renderSelection: { mode: 'custom', src: renderPath, position: normalizeRenderPosition(renderPosition) },
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
    secondaryAbilitySlots: submittedAbilityStats.secondaryAbilitySlots,
    secondaryAbilityAnchorIndex: submittedAbilityStats.secondaryAbilityAnchorIndex,
  }
}

export default function HeroGrid({ initialTab = 'Select' }: HeroGridProps) {
  const renderDragStateRef = useRef<RenderDragState | null>(null)
  const latestEditorRenderSelectionRef = useRef<EditorRenderSelection>({ mode: 'background', src: null })
  const startsInCreate = initialTab === 'Create'
  const [activeTab, setActiveTab] = useState<PrimaryTab>(startsInCreate ? 'Select' : initialTab)
  const [browseSort, setBrowseSort] = useState<CustomHeroSort>('new')
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseHeroes, setBrowseHeroes] = useState<CustomHeroSummary[]>([])
  const [browsePagination, setBrowsePagination] = useState<BrowsePagination | null>(null)
  const [isBrowseLoadingMore, setIsBrowseLoadingMore] = useState(false)
  const [selectedBrowseHeroId, setSelectedBrowseHeroId] = useState<string | null>(null)
  const [browseStatus, setBrowseStatus] = useState<string | null>(null)
  const [bookmarkedHeroes, setBookmarkedHeroes] = useState<CustomHeroSummary[]>([])
  const [bookmarksPagination, setBookmarksPagination] = useState<BrowsePagination | null>(null)
  const [isBookmarksLoadingMore, setIsBookmarksLoadingMore] = useState(false)
  const [selectedBookmarkedHeroId, setSelectedBookmarkedHeroId] = useState<string | null>(null)
  const [bookmarksStatus, setBookmarksStatus] = useState<string | null>(null)
  const [feedItems, setFeedItems] = useState<ActivityFeedItem[]>([])
  const [feedStatus, setFeedStatus] = useState<string | null>(null)
  const [hasSelectedHero, setHasSelectedHero] = useState(false)
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(startsInCreate)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowDetails(getStoredShowDetails()), 0)

    return () => window.clearTimeout(timeoutId)
  }, [])
  const [isSavingHero, setIsSavingHero] = useState(false)
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null)
  const [saveFailure, setSaveFailure] = useState<string | null>(null)
  const [lastSavePayload, setLastSavePayload] = useState<CustomHeroSavePayload | null>(null)
  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const [isEditorInteractionPanelOpen, setIsEditorInteractionPanelOpen] = useState(false)
  const activeHero = HEROES.find(hero => hero.slug === activeHeroSlug) ?? HEROES[0]
  const renderHero = HEROES.find(hero => hero.slug === renderHeroSlug) ?? activeHero
  const editorHero = editingCustomHero ?? templateHero ?? activeHero
  const selectedBrowseHero = useMemo(
    () => browseHeroes.find(hero => hero.id === selectedBrowseHeroId) ?? browseHeroes[0] ?? null,
    [browseHeroes, selectedBrowseHeroId],
  )
  const selectedBookmarkedHero = useMemo(
    () => bookmarkedHeroes.find(hero => hero.id === selectedBookmarkedHeroId) ?? bookmarkedHeroes[0] ?? null,
    [bookmarkedHeroes, selectedBookmarkedHeroId],
  )
  const selectedCollectionHero = activeTab === 'Browse' ? selectedBrowseHero : activeTab === 'Bookmarks' ? selectedBookmarkedHero : null
  const [editorDraft, setEditorDraft] = useState<HeroInfoDefinition>(() => cloneHeroInfo(activeHero.heroInfo))
  const [editorBackground, setEditorBackground] = useState(() => getEditorBackgroundForHero(activeHero))
  const [editorRenderSelection, setEditorRenderSelectionState] = useState<EditorRenderSelection>({ mode: 'background', src: null })
  const setEditorRenderSelection = useCallback((renderSelection: EditorRenderSelection) => {
    const normalizedSelection = normalizeRenderSelection(renderSelection)

    latestEditorRenderSelectionRef.current = normalizedSelection
    setEditorRenderSelectionState(normalizedSelection)
  }, [])
  const isCreateMode = activeTab === 'Create'
  const isCollectionTab = activeTab === 'Browse' || activeTab === 'Bookmarks'
  const shouldShowRender = isCreateMode || (isCollectionTab ? Boolean(selectedCollectionHero) : activeTab === 'Select' && hasSelectedHero)
  const editorRenderImage = editorRenderSelection.mode !== 'background' && editorRenderSelection.src ? editorRenderSelection.src : editorBackground
  const isCreateCustomRender = isCreateMode && editorRenderSelection.mode === 'custom' && Boolean(editorRenderSelection.src)
  const isCollectionCustomRender = Boolean(selectedCollectionHero && isCustomRenderPath(selectedCollectionHero.render))
  const baseRenderImage = isCreateMode
    ? isCreateCustomRender
      ? editorBackground
      : editorRenderImage
    : selectedCollectionHero
      ? isCollectionCustomRender
        ? selectedCollectionHero.background || FALLBACK_EDITOR_BACKGROUND
        : selectedCollectionHero.render
      : renderHero.render
  const customRenderImage = isCreateCustomRender
    ? editorRenderSelection.src
    : isCollectionCustomRender
      ? selectedCollectionHero?.render ?? null
      : null
  const customRenderPosition = isCreateCustomRender ? editorRenderSelection.position : selectedCollectionHero?.renderPosition
  const isEditorRenderMovable = isCreateCustomRender && !isEditorInteractionPanelOpen
  const baseRenderLabel = isCreateMode
    ? editorRenderSelection.mode === 'hero'
      ? 'Selected editor hero render'
      : 'Selected editor background'
    : selectedCollectionHero
      ? isCollectionCustomRender
        ? `${selectedCollectionHero.displayName} background`
        : `${selectedCollectionHero.displayName} render`
      : `${activeHero.displayName} render`
  const customRenderLabel = isCreateCustomRender
    ? 'Custom editor hero render'
    : selectedCollectionHero
      ? `${selectedCollectionHero.displayName} render`
      : 'Custom hero render'
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
    clearEditorRecovery()
    const renderState = getSavedRenderSelection(hero.render, hero.renderPosition)

    setEditingCustomHero(hero)
    setTemplateHero(null)
    setEditingHeroStats(hero.stats)
    setEditingAbilityStats(hero.abilityStats)
    setEditorDraft(cloneHeroInfo(hero.heroInfo))
    setEditorBackground(hero.background || renderState.background)
    setEditorRenderSelection(renderState.renderSelection)
    setEditorRevision(currentRevision => currentRevision + 1)
    setActiveTab('Create')
  }, [setEditorRenderSelection])

  const applyTemplateHeroToEditor = useCallback((hero: CustomHeroDetail) => {
    const renderState = getSavedRenderSelection(hero.render, hero.renderPosition)

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
  }, [setEditorRenderSelection])

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
  }, [setEditorRenderSelection])

  const startCreateFromTemplate = useCallback((template: HeroTemplateDefinition) => {
    clearEditorRecovery()
    const hero = template.hero
    const renderState = getSavedRenderSelection(hero.render, hero.renderPosition)

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
  }, [setEditorRenderSelection])

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
    function handleRenderDragPointerMove(event: PointerEvent) {
      const dragState = renderDragStateRef.current

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return
      }

      const nextPosition = {
        x: clampRenderOffset(dragState.startPosition.x + event.clientX - dragState.startClientX),
        y: clampRenderOffset(dragState.startPosition.y + event.clientY - dragState.startClientY),
      }

      setEditorRenderSelectionState(currentSelection => {
        if (currentSelection.mode === 'background') {
          return currentSelection
        }

        const nextSelection = normalizeRenderSelection({
          ...currentSelection,
          position: nextPosition,
        })

        latestEditorRenderSelectionRef.current = nextSelection

        return nextSelection
      })
    }

    function handleRenderDragPointerUp(event: PointerEvent) {
      if (renderDragStateRef.current?.pointerId === event.pointerId) {
        renderDragStateRef.current = null
      }
    }

    window.addEventListener('pointermove', handleRenderDragPointerMove)
    window.addEventListener('pointerup', handleRenderDragPointerUp)
    window.addEventListener('pointercancel', handleRenderDragPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleRenderDragPointerMove)
      window.removeEventListener('pointerup', handleRenderDragPointerUp)
      window.removeEventListener('pointercancel', handleRenderDragPointerUp)
    }
  }, [])

  function handleRenderDragPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isEditorRenderMovable || event.button !== 0 || shouldIgnoreRenderDragTarget(event.target)) {
      return
    }

    renderDragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: normalizeRenderPosition(editorRenderSelection.position),
    }
    event.preventDefault()
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const searchParams = new URLSearchParams(window.location.search)
    const heroId = searchParams.get('heroId')
    const requestedTab = searchParams.get('tab')

    if (heroId && requestedTab !== 'browse' && requestedTab !== 'bookmarks') {
      const timeoutId = window.setTimeout(() => {
        void loadSavedHero(heroId)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [loadSavedHero])

  const getBrowseUrl = useCallback((offset: number, limit = offset === 0 ? INITIAL_BROWSE_PAGE_SIZE : NEXT_BROWSE_PAGE_SIZE) => {
    const searchParams = new URLSearchParams({
      status: 'published',
      sort: browseSort,
      limit: String(limit),
      offset: String(offset),
    })
    const trimmedSearch = browseSearch.trim()

    if (trimmedSearch) {
      searchParams.set('search', trimmedSearch)
    }

    return `/api/heroes?${searchParams.toString()}`
  }, [browseSearch, browseSort])

  const getBookmarksUrl = useCallback((offset: number, limit = offset === 0 ? INITIAL_BROWSE_PAGE_SIZE : NEXT_BROWSE_PAGE_SIZE) => {
    const searchParams = new URLSearchParams({
      bookmarked: 'true',
      limit: String(limit),
      offset: String(offset),
    })
    const trimmedSearch = browseSearch.trim()

    if (trimmedSearch) {
      searchParams.set('search', trimmedSearch)
    }

    return `/api/heroes?${searchParams.toString()}`
  }, [browseSearch])

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

    async function loadBookmarkedHeroes() {
      setBookmarksStatus('Loading bookmarks...')

      try {
        const response = await fetch(getBookmarksUrl(0), {
          signal: abortController.signal,
        })
        const body = await response.json() as { heroes?: CustomHeroSummary[]; pagination?: BrowsePagination; error?: string }

        if (!response.ok) {
          throw new Error(getHeroResponseError(body, `Bookmarks request failed with ${response.status}`))
        }

        const nextHeroes = body.heroes ?? []
        const requestedHeroId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('heroId')

        setBookmarkedHeroes(nextHeroes)
        setBookmarksPagination(body.pagination ?? null)
        setSelectedBookmarkedHeroId(currentId => {
          if (requestedHeroId && nextHeroes.some(hero => hero.id === requestedHeroId)) {
            return requestedHeroId
          }

          return currentId && nextHeroes.some(hero => hero.id === currentId) ? currentId : nextHeroes[0]?.id ?? null
        })
        setBookmarksStatus(nextHeroes.length ? null : 'No bookmarked characters yet.')
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setBookmarksStatus(error instanceof Error ? error.message : 'Failed to load bookmarks.')
      }
    }

    void loadBookmarkedHeroes()

    return () => abortController.abort()
  }, [activeTab, getBookmarksUrl])

  useEffect(() => {
    if (activeTab !== 'Notifications') {
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
    setHasSelectedHero(true)

    if (heroSlug === activeHeroSlug) {
      return
    }

    const nextHero = HEROES.find(hero => hero.slug === heroSlug)

    if (nextHero) {
      clearEditorRecovery()
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
    const isUnpublishing = editingCustomHero?.status === 'published' && payload.status === 'private'
    const latestRenderSelection = latestEditorRenderSelectionRef.current
    const latestRenderPosition =
      latestRenderSelection.mode !== 'background' &&
      latestRenderSelection.src &&
      latestRenderSelection.src === payload.hero.render
        ? normalizeRenderPosition(latestRenderSelection.position)
        : normalizeRenderPosition(payload.hero.renderPosition)
    const payloadToSave: CustomHeroSavePayload = {
      ...payload,
      hero: {
        ...payload.hero,
        renderPosition: latestRenderPosition,
      },
    }

    setIsSavingHero(true)
    setLastSavePayload(payloadToSave)
    setSaveFailure(null)
    setSaveStatusMessage(isUnpublishing ? 'Unpublishing hero...' : payloadToSave.status === 'published' ? 'Publishing hero...' : 'Saving private hero...')

    try {
      if (navigator.onLine === false) {
        throw new Error('Network connection is offline.')
      }

      const response = await fetch('/api/heroes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadToSave),
      })
      const body = await readApiResponse<{ hero?: CustomHeroDetail } & ApiErrorPayload>(response)

      if (!response.ok || !body?.hero) {
        const requestError = parseClientRequestError(
          response,
          body,
          body ? `Save request failed with ${response.status}` : 'The save service returned an invalid response.',
        )

        setSaveFailure(getUserFacingSaveError(requestError.message, requestError.code))
        setSaveStatusMessage(null)
        if (requestError.isSessionExpired) setIsSessionExpired(true)
        return
      }

      applySavedHeroToEditor({
        ...body.hero,
        renderPosition: body.hero.renderPosition ?? payloadToSave.hero.renderPosition,
        abilityStats: mergeSubmittedSecondaryAbilities(body.hero.abilityStats, payloadToSave.abilityStats),
      })
      clearEditorRecovery()
      setLastSavePayload(null)
      if (isUnpublishing) {
        setBrowseHeroes(currentHeroes => currentHeroes.filter(hero => hero.id !== body.hero?.id))
        setBookmarkedHeroes(currentHeroes => currentHeroes.filter(hero => hero.id !== body.hero?.id))
      }
      setSaveStatusMessage(isUnpublishing ? 'Hero unpublished and moved to your private saves.' : body.hero.status === 'published' ? 'Hero published to Browse.' : 'Private hero saved to your profile.')
    } catch (error) {
      const requestError = getNetworkRequestError(error, 'Failed to save hero.')

      setSaveFailure(getUserFacingSaveError(requestError.message, requestError.code))
      setSaveStatusMessage(null)
    } finally {
      setIsSavingHero(false)
    }
  }

  function retrySaveHero() {
    if (lastSavePayload) void handleSaveHero(lastSavePayload)
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
      setBookmarkedHeroes(currentHeroes => currentHeroes.map(hero => (hero.id === body.hero?.id ? body.hero : hero)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to like hero.'

      if (activeTab === 'Bookmarks') {
        setBookmarksStatus(message)
      } else {
        setBrowseStatus(message)
      }
    }
  }

  const handleLoadMoreBrowseHeroes = useCallback(async () => {
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
  }, [browseHeroes.length, browsePagination?.hasMore, getBrowseUrl, isBrowseLoadingMore])

  const handleLoadMoreBookmarkedHeroes = useCallback(async () => {
    if (!bookmarksPagination?.hasMore || isBookmarksLoadingMore) {
      return
    }

    setIsBookmarksLoadingMore(true)

    try {
      const response = await fetch(getBookmarksUrl(bookmarkedHeroes.length))
      const body = await response.json() as { heroes?: CustomHeroSummary[]; pagination?: BrowsePagination; error?: string }

      if (!response.ok) {
        throw new Error(getHeroResponseError(body, `Bookmarks request failed with ${response.status}`))
      }

      const nextHeroes = body.heroes ?? []

      setBookmarkedHeroes(currentHeroes => [...currentHeroes, ...nextHeroes.filter(nextHero => !currentHeroes.some(currentHero => currentHero.id === nextHero.id))])
      setBookmarksPagination(body.pagination ?? null)
      setBookmarksStatus(null)
    } catch (error) {
      setBookmarksStatus(error instanceof Error ? error.message : 'Failed to load more bookmarks.')
    } finally {
      setIsBookmarksLoadingMore(false)
    }
  }, [bookmarkedHeroes.length, bookmarksPagination?.hasMore, getBookmarksUrl, isBookmarksLoadingMore])

  const browseScrollRef = useInfiniteScroll({
    hasMore: activeTab === 'Browse' && Boolean(browsePagination?.hasMore),
    isLoading: isBrowseLoadingMore,
    onLoadMore: handleLoadMoreBrowseHeroes,
  })
  const bookmarksScrollRef = useInfiniteScroll({
    hasMore: activeTab === 'Bookmarks' && Boolean(bookmarksPagination?.hasMore),
    isLoading: isBookmarksLoadingMore,
    onLoadMore: handleLoadMoreBookmarkedHeroes,
  })

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
      if (activeTab === 'Bookmarks') {
        setBookmarksStatus('Loading template...')
      } else {
        setBrowseStatus('Loading template...')
      }

      const response = await fetch(`/api/heroes?id=${encodeURIComponent(heroId)}`)
      const body = await response.json() as { hero?: CustomHeroDetail; error?: string }

      if (!response.ok || !body.hero) {
        throw new Error(getHeroResponseError(body, `Template request failed with ${response.status}`))
      }

      applyTemplateHeroToEditor(body.hero)
      void recordTemplateCopy(heroId)
      setBookmarksStatus(null)
      setBrowseStatus(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load template.'

      if (activeTab === 'Bookmarks') {
        setBookmarksStatus(message)
      } else {
        setBrowseStatus(message)
      }
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
        boon: body.boon ?? fallbackStats.boon,
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

  function handleExitCreateEditor() {
    setIsTemplateModalOpen(false)
    setActiveTab('Select')
  }

  return (
    <div className={`${styles.shell} ${isEditorRenderMovable ? styles.renderDragEnabled : ''}`} onPointerDown={isEditorRenderMovable ? handleRenderDragPointerDown : undefined} data-testid="hero-grid-shell">
      <div className={styles.backgroundLayer} />
      <div className={styles.smokeLayer} />
      <div className={styles.washLayer} />

      <div className={styles.renderLayer}>
        <div className={styles.renderFade} />
        {shouldShowRender ? (
          <div
            key={isCreateMode ? `${editorRenderSelection.mode}:${baseRenderImage}` : isCollectionTab ? selectedCollectionHero?.id ?? `${activeTab.toLowerCase()}-empty` : renderHero.slug}
            className={`${styles.renderFrame} ${renderPhase === 'fade-out' ? styles.renderFrameOutgoing : renderPhase === 'fade-in' ? styles.renderFrameIncoming : ''}`}
            role="img"
            aria-label={baseRenderLabel}
            aria-hidden={renderPhase === 'fade-out'}
            data-testid="hero-render-layer"
            style={{
              backgroundImage: `url('${baseRenderImage}')`,
            }}
          />
        ) : null}
        {customRenderImage ? (
          <div
            className={`${styles.renderFrame} ${isEditorRenderMovable ? styles.renderDraggableFrame : ''}`}
            role="img"
            aria-label={customRenderLabel}
            data-testid="editor-custom-render-layer"
            onPointerDown={isEditorRenderMovable ? handleRenderDragPointerDown : undefined}
            style={{
              backgroundImage: `url('${customRenderImage}')`,
              backgroundPosition: getRenderBackgroundPosition(customRenderPosition),
            }}
          />
        ) : null}
      </div>

      {activeTab === 'Select' && !hasSelectedHero ? (
        <h1 className={styles.landingTitle} data-testid="landing-title">CURSED CONCEPTS</h1>
      ) : null}

      <div className={styles.content}>
        <nav aria-label="Primary sections" className={styles.tabs} data-testid="primary-top-bar">
          {TAB_ITEMS.map(tab => {
            const isActive = tab.label === 'Create' ? isTemplateModalOpen || activeTab === 'Create' : tab.label === activeTab && !isTemplateModalOpen

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

        {isCollectionTab ? (
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
            {activeTab === 'Browse' ? <nav className={styles.browseNav} aria-label="Browse categories">
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
            </nav> : null}
          </div>
        ) : null}

        {isCollectionTab && selectedCollectionHero ? (
          <div className={styles.browseHeroActions}>
            {selectedCollectionHero.viewerCanEdit ? (
              <button type="button" onClick={() => loadSavedHero(selectedCollectionHero.id)}>
                Edit Hero
              </button>
            ) : null}
            {!selectedCollectionHero.viewerCanEdit && selectedCollectionHero.allowCopies ? (
              <button type="button" onClick={() => handleUseTemplate(selectedCollectionHero.id)}>
                Use as Template
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'Notifications' ? (
          <main className={styles.activityMain}>
            {feedStatus ? <p className={styles.browseStatus} role="status">{feedStatus}</p> : null}
            <section className={styles.activityFeed} aria-label="Activity feed">
              {feedItems.map(item => (
                <article key={item.id} className={styles.activityItem}>
                  <span className={styles.activityPortrait}>
                    <Image
                      src={getThumbnailUrl(item.heroPortrait, 144, 144)}
                      alt=""
                      fill
                      sizes="72px"
                      placeholder="blur"
                      blurDataURL={IMAGE_BLUR_DATA_URL}
                    />
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
          <main className={`${styles.main} ${isCollectionTab ? styles.browseMain : ''}`}>
            {(isCollectionTab ? Boolean(selectedCollectionHero) : hasSelectedHero) ? (
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
            ) : null}
            {activeTab === 'Browse' && browseStatus ? <p className={styles.browseStatus} role="status">{browseStatus}</p> : null}
            {activeTab === 'Bookmarks' && bookmarksStatus ? <p className={styles.browseStatus} role="status">{bookmarksStatus}</p> : null}
            <section className={styles.grid}>
              {Array.from({ length: isCollectionTab ? Math.max(GRID_SIZE, activeTab === 'Browse' ? browseHeroes.length : bookmarkedHeroes.length) : GRID_SIZE }).map((_, index) => {
                if (isCollectionTab) {
                  const heroes = activeTab === 'Browse' ? browseHeroes : bookmarkedHeroes
                  const hero = heroes[index]

                  if (!hero) {
                    return <div key={`empty-${index}`} data-testid="hero-empty-slot" aria-hidden="true" className={styles.emptySlot} />
                  }

                  const isSelected = hero.id === selectedCollectionHero?.id

                  return (
                    <article key={hero.id} className={styles.browseCard}>
                      <button
                        type="button"
                        data-testid="hero-card"
                        aria-label={`Select character ${hero.displayName}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (activeTab === 'Browse') {
                            setSelectedBrowseHeroId(hero.id)
                          } else {
                            setSelectedBookmarkedHeroId(hero.id)
                          }
                        }}
                        className={`${styles.heroCard} ${isSelected ? styles.heroCardActive : ''}`}
                      >
                        <span className={styles.heroBacker} />
                        <span className={styles.browseBackground} data-testid="browse-card-background" style={{ backgroundImage: `url('${hero.background}')` }} aria-hidden="true" />
                        <span className={styles.heroPortraitWrap}>
                          <Image
                            src={getThumbnailUrl(hero.portrait, 260, 420)}
                            alt={hero.displayName}
                            fill
                            className={`${styles.heroPortrait} ${isSelected ? styles.heroPortraitActive : ''}`}
                            sizes="(max-width: 1024px) 25vw, 12vw"
                            preload={index < 8}
                            placeholder="blur"
                            blurDataURL={IMAGE_BLUR_DATA_URL}
                          />
                        </span>
                        <span className={styles.heroBorder} />
                        <span className={styles.heroTint} />
                        <span className={styles.heroNameBadge} data-testid="hero-name-badge" aria-hidden="true">
                          {hero.displayName}
                        </span>
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

                const isSelected = hasSelectedHero && hero.slug === activeHero.slug

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
                        preload={index < 8}
                        placeholder="blur"
                        blurDataURL={IMAGE_BLUR_DATA_URL}
                      />
                    </span>
                    <span className={styles.heroBorder} />
                    <span className={styles.heroTint} />
                    <span className={styles.heroNameBadge} data-testid="hero-name-badge" aria-hidden="true">
                      {hero.displayName}
                    </span>
                  </button>
                )
              })}
            </section>
            {activeTab === 'Browse' && browsePagination?.hasMore ? (
              <button ref={browseScrollRef} type="button" className={styles.loadMoreButton} onClick={handleLoadMoreBrowseHeroes} disabled={isBrowseLoadingMore}>
                {isBrowseLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            ) : null}
            {activeTab === 'Bookmarks' && bookmarksPagination?.hasMore ? (
              <button ref={bookmarksScrollRef} type="button" className={styles.loadMoreButton} onClick={handleLoadMoreBookmarkedHeroes} disabled={isBookmarksLoadingMore}>
                {isBookmarksLoadingMore ? 'Loading...' : 'Load More'}
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
          savedHeroStatus={editingCustomHero?.status ?? 'private'}
          allowCopies={editingCustomHero?.allowCopies ?? false}
          initialStats={editingHeroStats}
          initialAbilityStats={editingAbilityStats}
          isSaving={isSavingHero}
          saveStatusMessage={saveStatusMessage}
          saveFailure={saveFailure}
          onRetrySave={retrySaveHero}
          onBackgroundChange={setEditorBackground}
          onRenderSelectionChange={setEditorRenderSelection}
          onDraftChange={setEditorDraft}
          onSaveHero={handleSaveHero}
          onInteractionPanelOpenChange={setIsEditorInteractionPanelOpen}
          onExitEditor={handleExitCreateEditor}
        />
      ) : isCollectionTab ? (
        selectedCollectionHero ? <HeroInfoCluster hero={selectedCollectionHero} showDetails={showDetails} /> : null
      ) : activeTab === 'Select' && hasSelectedHero ? (
        <HeroInfoCluster hero={activeHero} showDetails={showDetails} onCreateFromHero={() => void handleCreateFromSelectedHero(activeHero)} />
      ) : null}

      {isCreateMode ? (
        <BackstoryModule
          hero={backstoryHero}
          accentImageSrc={editorRenderImage}
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
      <ConnectionStatus />
      <LoadingOverlay visible={isSavingHero} status={saveStatusMessage ? `[SYS] ${saveStatusMessage}` : undefined} />
      <SessionExpiredModal open={isSessionExpired} onDismiss={() => setIsSessionExpired(false)} />
    </div>
  )
}

'use client'

import { Bookmark, MessageSquare, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroAbilityIconRow from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import type { AbilityIconTarget } from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import ReportDialog from '@/components/Moderation/ReportDialog'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import HeroStatsBoonPanel from '@/components/panels/hero-stats-boon-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import PanelVariantTabs, { BASE_PANEL_ID } from '@/components/PanelVariantTabs/PanelVariantTabs'
import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'
import type { SidebarTabId } from '@/components/SidebarTabs/SidebarTabs'
import { buildEmptyHeroStats, buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import { buildDefaultAbilityStats, getSecondaryAbilitySlots } from '@/lib/ability-editor-types'
import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import { ABILITY_ICON_GROUPS, PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import cn from '@/lib/utilsd'
import { DEFAULT_HERO_NAME_FONT_FAMILY, DEFAULT_HERO_NAME_FONT_SIZE, DEFAULT_HERO_NAME_FONT_WEIGHT, type HeroDefinition } from '@/lib/hero-data'

import styles from './HeroInfoCluster.module.css'

interface HeroInfoClusterProps {
  hero: HeroDefinition
  showDetails?: boolean
  onCreateFromHero?: () => void
}

interface SocialHeroDefinition extends HeroDefinition {
  id?: string
  bookmarkedByCurrentUser?: boolean
  abilityStats?: AbilityStatsPayload
}

interface HeroStatsState {
  heroKey: string
  data: HeroStatsWithAbilityPayload
  error: string | null
}

interface HeroStatsWithAbilityPayload extends HeroStatsPayload {
  abilityStats?: AbilityStatsPayload
}

interface CommentItem {
  id: string
  authorName: string
  content: string
  viewerCanDelete: boolean
  createdAt: string
}

function getCustomHeroId(hero: HeroDefinition) {
  const id = (hero as SocialHeroDefinition).id

  return typeof id === 'string' && id.length > 0 ? id : null
}

function getResponseError(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error
  }

  return fallback
}

function formatNoteTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function HeroInfoCluster({ hero, showDetails = false, onCreateFromHero }: HeroInfoClusterProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId | null>(null)
  const heroId = getCustomHeroId(hero)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsHeroId, setCommentsHeroId] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsStatus, setCommentsStatus] = useState<string | null>(null)
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [bookmarkOverride, setBookmarkOverride] = useState<{ heroId: string; value: boolean } | null>(null)
  const [selectedAbilityTarget, setSelectedAbilityTarget] = useState<AbilityIconTarget | null>(null)
  const [activeBoonPanelId, setActiveBoonPanelId] = useState(BASE_PANEL_ID)
  const [activeWeaponPanelId, setActiveWeaponPanelId] = useState(BASE_PANEL_ID)
  const [activeVitalityPanelId, setActiveVitalityPanelId] = useState(BASE_PANEL_ID)
  const [activeSpiritPanelId, setActiveSpiritPanelId] = useState(BASE_PANEL_ID)
  const statsRequestKey = heroId ?? hero.slug
  const fallbackStats = useMemo(() => heroId ? buildEmptyHeroStats(hero) : buildHeroStatsSeed(hero), [hero, heroId])
  const [statsState, setStatsState] = useState<HeroStatsState>(() => ({
    heroKey: statsRequestKey,
    data: fallbackStats,
    error: null,
  }))
  const statsData: HeroStatsWithAbilityPayload = statsState.heroKey === statsRequestKey ? statsState.data : fallbackStats
  const heroInfo = statsData.heroInfo ?? hero.heroInfo
  const displayHero = useMemo(() => ({ ...hero, heroInfo }), [hero, heroInfo])
  const nameTextStyle = {
    '--hero-info-name-color': heroInfo.nameColor,
    color: heroInfo.nameColor,
    fontSize: heroInfo.nameFontSize ?? DEFAULT_HERO_NAME_FONT_SIZE,
    fontFamily: heroInfo.nameFontFamily ?? DEFAULT_HERO_NAME_FONT_FAMILY,
    fontWeight: heroInfo.nameFontWeight ?? DEFAULT_HERO_NAME_FONT_WEIGHT,
  } as CSSProperties
  const fallbackAbilityStats = useMemo(() => buildDefaultAbilityStats(displayHero), [displayHero])
  const isBookmarked = bookmarkOverride?.heroId === heroId
    ? bookmarkOverride.value
    : Boolean((hero as SocialHeroDefinition).bookmarkedByCurrentUser)
  const visibleComments = commentsHeroId === heroId ? comments : []
  const activeBoonPanel = statsData.boon.panels?.find(panel => panel.id === activeBoonPanelId)
  const activeWeaponPanel = statsData.weapon.panels?.find(panel => panel.id === activeWeaponPanelId)
  const activeVitalityPanel = statsData.vitality.panels?.find(panel => panel.id === activeVitalityPanelId)
  const activeSpiritPanel = statsData.spirit.panels?.find(panel => panel.id === activeSpiritPanelId)

  useEffect(() => {
    if (!activeTabId) return undefined

    function handlePanelClickAway(event: globalThis.PointerEvent) {
      if (event.target instanceof Element && event.target.closest('[data-testid="hero-sidebar-tabs"], [data-hero-stat-panel="true"], [role="dialog"]')) return
      setActiveTabId(null)
    }

    document.addEventListener('pointerdown', handlePanelClickAway)
    return () => document.removeEventListener('pointerdown', handlePanelClickAway)
  }, [activeTabId])

  function handleTabSelect(tabId: SidebarTabId) {
    setActiveTabId(current => current === tabId ? null : tabId)
  }

  useEffect(() => {
    const abortController = new AbortController()

    async function loadHeroStats() {
      try {
        const response = await fetch(`/api/heroes/${encodeURIComponent(statsRequestKey)}/stats`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Hero stats request failed with ${response.status}`)
        }

        const data = (await response.json()) as HeroStatsWithAbilityPayload

        setStatsState({
          heroKey: statsRequestKey,
          data,
          error: null,
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setStatsState({
          heroKey: statsRequestKey,
          data: fallbackStats,
          error: error instanceof Error ? error.message : 'Failed to load hero stats',
        })
      }
    }

    void loadHeroStats()

    return () => abortController.abort()
  }, [fallbackStats, statsRequestKey])

  useEffect(() => {
    if (!heroId || !isCommentsOpen) {
      return undefined
    }

    const abortController = new AbortController()
    const currentHeroId = heroId

    async function loadComments() {
      setCommentsStatus('Loading comments...')

      try {
        const response = await fetch(`/api/heroes/${encodeURIComponent(currentHeroId)}/comments`, {
          signal: abortController.signal,
        })
        const body = await response.json() as { comments?: CommentItem[]; error?: string }

        if (!response.ok) {
          throw new Error(getResponseError(body, `Comments request failed with ${response.status}`))
        }

        const nextComments = body.comments ?? []

        setComments(nextComments)
        setCommentsHeroId(currentHeroId)
        setCommentsStatus(nextComments.length ? null : 'No comments yet.')
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setCommentsStatus(error instanceof Error ? error.message : 'Failed to load comments.')
      }
    }

    void loadComments()

    return () => abortController.abort()
  }, [heroId, isCommentsOpen])

  async function handleBookmarkToggle() {
    if (!heroId) {
      return
    }

    const previousValue = isBookmarked
    const optimisticValue = !previousValue

    setBookmarkOverride({ heroId, value: optimisticValue })

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json() as { bookmark?: { bookmarked: boolean }; error?: string }

      if (!response.ok || !body.bookmark) {
        throw new Error(getResponseError(body, `Bookmark request failed with ${response.status}`))
      }

      setBookmarkOverride({ heroId, value: body.bookmark.bookmarked })
    } catch (error) {
      setBookmarkOverride({ heroId, value: previousValue })
      setCommentsStatus(error instanceof Error ? error.message : 'Failed to update bookmark.')
    }
  }

  async function handlePostComment() {
    if (!heroId || isPostingComment) {
      return
    }

    setIsPostingComment(true)
    setCommentsStatus(null)

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentDraft }),
      })
      const body = await response.json() as { comment?: CommentItem; error?: string }

      if (!response.ok || !body.comment) {
        throw new Error(getResponseError(body, `Comment request failed with ${response.status}`))
      }

      setCommentsHeroId(heroId)
      setComments(currentComments => [body.comment!, ...(commentsHeroId === heroId ? currentComments : [])])
      setCommentDraft('')
    } catch (error) {
      setCommentsStatus(error instanceof Error ? error.message : 'Failed to add comment.')
    } finally {
      setIsPostingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!heroId) {
      return
    }

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/comments?commentId=${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json() as { deleted?: boolean; error?: string }

      if (!response.ok || !body.deleted) {
        throw new Error(getResponseError(body, `Comment delete failed with ${response.status}`))
      }

      setComments(currentComments => (commentsHeroId === heroId ? currentComments.filter(comment => comment.id !== commentId) : currentComments))
    } catch (error) {
      setCommentsStatus(error instanceof Error ? error.message : 'Failed to delete comment.')
    }
  }

  const tags = [
    { text: heroInfo.tag1Text, tilt: heroInfo.tag1Tilt, offsetY: heroInfo.tag1OffsetY },
    { text: heroInfo.tag2Text, tilt: heroInfo.tag2Tilt, offsetY: heroInfo.tag2OffsetY },
    { text: heroInfo.tag3Text, tilt: heroInfo.tag3Tilt, offsetY: heroInfo.tag3OffsetY },
  ]

  const abilityStats = statsData.abilityStats ?? (hero as SocialHeroDefinition).abilityStats
  const previewAbilityStats = abilityStats ?? fallbackAbilityStats
  const secondaryAbilities = abilityStats?.secondaryAbilities ?? []
  const secondaryAbilitySlots = secondaryAbilities.length
    ? getSecondaryAbilitySlots(abilityStats?.secondaryAbilitySlots, abilityStats?.secondaryAbilityAnchorIndex, [])
    : []
  const selectedAbility = selectedAbilityTarget?.set === 'secondary'
    ? secondaryAbilities[selectedAbilityTarget.index] ?? null
    : selectedAbilityTarget
      ? previewAbilityStats.abilities[selectedAbilityTarget.index] ?? null
      : null

  useEffect(() => {
    if (!selectedAbilityTarget) {
      return
    }

    function handlePreviewClickAway(event: globalThis.PointerEvent) {
      if (event.target instanceof Element && event.target.closest('[data-ability-preview-panel="true"]')) {
        return
      }

      setSelectedAbilityTarget(null)
    }

    document.addEventListener('pointerdown', handlePreviewClickAway)

    return () => {
      document.removeEventListener('pointerdown', handlePreviewClickAway)
    }
  }, [selectedAbilityTarget])

  return (
    <>
      <aside
        className={styles.cluster}
        data-hero-slug={hero.slug}
        data-testid="hero-info-cluster"
        aria-label={`${hero.displayName} information cluster`}
      >
        <SidebarTabs activeTabId={activeTabId} onSelect={handleTabSelect} />

      {activeTabId === null ? (
        <div className={styles.panelContents} data-hero-stat-panel="true">
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
              <span className={styles.nameText} data-testid="hero-info-name-text" style={nameTextStyle}>
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

          <HeroAbilityIconRow
            heroInfo={heroInfo}
            secondaryAbilities={secondaryAbilities}
            secondaryAbilitySlots={secondaryAbilitySlots}
            activeTarget={selectedAbilityTarget}
            onAbilityClick={target => {
              setSelectedAbilityTarget(current => (
                current?.set === target.set && current.index === target.index ? null : target
              ))
            }}
            className={styles.abilities}
            primaryLabel={slot => `View Ability ${slot}`}
            secondaryLabel={slot => `View Secondary Ability ${slot}`}
          />
        </div>
      ) : null}

      <div
        id="hero-panel-overview"
        data-hero-stat-panel="true"
        role="tabpanel"
        aria-label={`${hero.displayName} boon rewards`}
        hidden={activeTabId !== 'overview'}
        className={cn(activeTabId === 'overview' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <PanelVariantTabs baseName="Boon" baseTabName={statsData.boon.name ?? 'Boon Rewards'} variants={statsData.boon.panels} activeId={activeBoonPanel?.id ?? BASE_PANEL_ID} onSelect={setActiveBoonPanelId} />
        <HeroStatsBoonPanel heroName={hero.displayName} panelName={activeBoonPanel?.name ?? statsData.boon.name ?? 'Boon Rewards'} stats={activeBoonPanel?.stats ?? statsData.boon.stats} />
      </div>

      <div
        id="hero-panel-weapon"
        data-hero-stat-panel="true"
        role="tabpanel"
        aria-label={`${hero.displayName} weapon stats`}
        hidden={activeTabId !== 'weapon'}
        className={cn(activeTabId === 'weapon' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <PanelVariantTabs baseName="Weapon" baseTabName={statsData.weapon.weaponName} variants={statsData.weapon.panels} activeId={activeWeaponPanel?.id ?? BASE_PANEL_ID} onSelect={setActiveWeaponPanelId} />
        <WeaponPanel
          weaponName={activeWeaponPanel?.name ?? statsData.weapon.weaponName}
          weaponDesc={activeWeaponPanel?.weaponDesc ?? statsData.weapon.weaponDesc}
          gunImageSrc={activeWeaponPanel?.gunImageSrc ?? statsData.weapon.gunImageSrc}
          weaponAttributes={activeWeaponPanel?.weaponAttributes ?? statsData.weapon.weaponAttributes}
          weaponStats={activeWeaponPanel?.stats ?? statsData.weapon.stats}
          bulletDPS={activeWeaponPanel?.bulletDPS ?? statsData.weapon.bulletDPS}
          weaponMinRange={activeWeaponPanel?.weaponMinRange ?? statsData.weapon.weaponMinRange}
          weaponMaxRange={activeWeaponPanel?.weaponMaxRange ?? statsData.weapon.weaponMaxRange}
          showDetails={showDetails}
        />
      </div>

      <div
        id="hero-panel-vitality"
        data-hero-stat-panel="true"
        role="tabpanel"
        aria-label={`${hero.displayName} vitality stats`}
        hidden={activeTabId !== 'vitality'}
        className={cn(activeTabId === 'vitality' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <PanelVariantTabs baseName="Vitality" baseTabName={statsData.vitality.name ?? 'Vitality'} variants={statsData.vitality.panels} activeId={activeVitalityPanel?.id ?? BASE_PANEL_ID} onSelect={setActiveVitalityPanelId} />
        <HeroStatsVitalityPanel hero={hero} stats={activeVitalityPanel?.stats ?? statsData.vitality.stats} showDetails={showDetails} />
      </div>

      <div
        id="hero-panel-spirit"
        data-hero-stat-panel="true"
        role="tabpanel"
        aria-label={`${hero.displayName} spirit stats`}
        hidden={activeTabId !== 'spirit'}
        className={cn(activeTabId === 'spirit' ? styles.tabPanelVisible : styles.tabPanelHidden)}
      >
        <PanelVariantTabs baseName="Spirit" baseTabName={statsData.spirit.name ?? 'Spirit'} variants={statsData.spirit.panels} activeId={activeSpiritPanel?.id ?? BASE_PANEL_ID} onSelect={setActiveSpiritPanelId} />
        <HeroStatsSpiritPanel hero={hero} stats={activeSpiritPanel?.topStats ?? statsData.spirit.topStats} spiritPowerStat={activeSpiritPanel?.spiritPowerStat ?? statsData.spirit.spiritPowerStat} showDetails={showDetails} />
      </div>

        {heroId ? (
          <>
            <section className={styles.socialPanel} aria-label={`${hero.displayName} social actions`}>
              <div className={styles.socialActions}>
                <button
                  type="button"
                  className={cn(styles.actionIconButton, styles.bookmarkButton, isBookmarked && styles.bookmarkButtonActive)}
                  aria-label={isBookmarked ? `Remove ${hero.displayName} bookmark` : `Bookmark ${hero.displayName}`}
                  aria-pressed={isBookmarked}
                  onClick={handleBookmarkToggle}
                >
                  <Bookmark aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={cn(styles.actionIconButton, styles.commentsToggle)}
                  aria-label={`Open ${hero.displayName} comments`}
                  aria-expanded={isCommentsOpen}
                  onClick={() => setIsCommentsOpen(true)}
                >
                  <MessageSquare aria-hidden="true" />
                </button>
                <ReportDialog endpoint={`/api/heroes/${encodeURIComponent(heroId)}/report`} contentLabel="character" compact className={styles.actionIconButton} />
              </div>
            </section>

            {isCommentsOpen ? (
              <div
                className={styles.commentsModalBackdrop}
                role="presentation"
                onPointerDown={event => {
                  if (event.target === event.currentTarget) {
                    setIsCommentsOpen(false)
                  }
                }}
              >
                <section className={styles.commentsModal} role="dialog" aria-modal="true" aria-labelledby={`${heroId}-comments-title`}>
                  <header className={styles.commentsModalHeader}>
                    <div>
                      <p>Community comments</p>
                      <h2 id={`${heroId}-comments-title`}>{hero.displayName} comments</h2>
                    </div>
                    <button type="button" className={styles.commentsModalClose} aria-label="Close comments" onClick={() => setIsCommentsOpen(false)}>
                      <X aria-hidden="true" />
                    </button>
                  </header>
                  <div className={styles.commentsDrawer}>
                <form
                  className={styles.commentForm}
                  onSubmit={event => {
                    event.preventDefault()
                    void handlePostComment()
                  }}
                >
                  <label className="sr-only" htmlFor={`${heroId}-comment`}>Comment</label>
                  <textarea
                    id={`${heroId}-comment`}
                    maxLength={500}
                    value={commentDraft}
                    onChange={event => setCommentDraft(event.target.value)}
                    placeholder="Add a comment"
                  />
                  <button type="submit" disabled={isPostingComment || !commentDraft.trim()} aria-label="Post comment">
                    <Send aria-hidden="true" />
                  </button>
                </form>
                {commentsStatus ? <p className={styles.commentsStatus} role="status">{commentsStatus}</p> : null}
                {visibleComments.length ? (
                  <ul className={styles.commentsList}>
                    {visibleComments.map(comment => (
                      <li key={comment.id} className={styles.commentItem}>
                        <div>
                          <strong>{comment.authorName}</strong>
                          <time dateTime={comment.createdAt}>{formatNoteTime(comment.createdAt)}</time>
                        </div>
                        <p>{comment.content}</p>
                        <div className={styles.commentActions}>
                          <ReportDialog
                            endpoint={`/api/comments/${encodeURIComponent(comment.id)}/report`}
                            contentLabel="comment"
                            compact
                            className={styles.commentIconButton}
                            onReported={moderationStatus => {
                              if (moderationStatus === 'hidden') {
                                setComments(currentComments => currentComments.filter(item => item.id !== comment.id))
                              }
                            }}
                          />
                          {comment.viewerCanDelete ? (
                            <button type="button" className={cn(styles.commentDeleteButton, styles.commentIconButton)} aria-label="Delete comment" onClick={() => handleDeleteComment(comment.id)}>
                              <Trash2 aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {statsState.error ? <span className="sr-only" role="status">Using fallback hero stats</span> : null}
      </aside>
      {selectedAbility ? (
        <AbilityEditor
          key={`${selectedAbilityTarget?.set ?? 'primary'}-${selectedAbilityTarget?.index ?? 0}-${selectedAbility.slot}`}
          ability={selectedAbility}
          mode="preview"
          className={styles.abilityViewerDock}
          propertyIconGroups={PROPERTY_ICON_GROUPS}
          hero={displayHero}
          heroInfo={heroInfo}
          activeAbilityTarget={selectedAbilityTarget ?? undefined}
          secondaryAbilities={secondaryAbilities}
          secondaryAbilitySlots={secondaryAbilitySlots}
          isSecondAbilitySetEnabled={secondaryAbilities.length > 0}
          abilityIconGroups={ABILITY_ICON_GROUPS}
          showDetails={showDetails}
          onAbilitySelect={target => setSelectedAbilityTarget(target)}
          onCancel={() => setSelectedAbilityTarget(null)}
        />
      ) : null}
      <BackstoryModule
        hero={displayHero}
        onCreateFromHero={onCreateFromHero}
      />
    </>
  )
}

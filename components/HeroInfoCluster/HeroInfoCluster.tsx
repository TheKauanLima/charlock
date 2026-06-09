'use client'

import { Bookmark, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'
import type { SidebarTabId } from '@/components/SidebarTabs/SidebarTabs'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import { buildCharacterExportPayload, getCharacterShareUrl } from '@/lib/character-export'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

import styles from './HeroInfoCluster.module.css'

interface HeroInfoClusterProps {
  hero: HeroDefinition
}

const ABILITY_SLOTS = [1, 2, 3, 4] as const

interface SocialHeroDefinition extends HeroDefinition {
  id?: string
  bookmarkedByCurrentUser?: boolean
}

interface HeroStatsState {
  heroSlug: string
  data: HeroStatsPayload
  error: string | null
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

export default function HeroInfoCluster({ hero }: HeroInfoClusterProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId>('overview')
  const heroId = getCustomHeroId(hero)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsHeroId, setCommentsHeroId] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsStatus, setCommentsStatus] = useState<string | null>(null)
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [bookmarkOverride, setBookmarkOverride] = useState<{ heroId: string; value: boolean } | null>(null)
  const fallbackStats = useMemo(() => buildHeroStatsSeed(hero), [hero])
  const [statsState, setStatsState] = useState<HeroStatsState>(() => ({
    heroSlug: hero.slug,
    data: fallbackStats,
    error: null,
  }))
  const statsData = statsState.heroSlug === hero.slug ? statsState.data : fallbackStats
  const heroInfo = statsData.heroInfo ?? hero.heroInfo
  const displayHero = useMemo(() => ({ ...hero, heroInfo }), [hero, heroInfo])
  const shareUrl = heroId && typeof window !== 'undefined' ? getCharacterShareUrl(heroId, window.location.origin) : null
  const exportPayload = buildCharacterExportPayload(displayHero, statsData, {
    heroInfo,
    shareUrl,
  })
  const isBookmarked = bookmarkOverride?.heroId === heroId
    ? bookmarkOverride.value
    : Boolean((hero as SocialHeroDefinition).bookmarkedByCurrentUser)
  const visibleComments = commentsHeroId === heroId ? comments : []

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

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/bookmark`, {
        method: 'POST',
      })
      const body = await response.json() as { bookmark?: { bookmarked: boolean }; error?: string }

      if (!response.ok || !body.bookmark) {
        throw new Error(getResponseError(body, `Bookmark request failed with ${response.status}`))
      }

      setBookmarkOverride({ heroId, value: body.bookmark.bookmarked })
    } catch (error) {
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

        {heroId ? (
          <section className={styles.socialPanel} aria-label={`${hero.displayName} social actions`}>
            <div className={styles.socialActions}>
              <button
                type="button"
                className={`${styles.bookmarkButton} ${isBookmarked ? styles.bookmarkButtonActive : ''}`}
                aria-pressed={isBookmarked}
                onClick={handleBookmarkToggle}
              >
                <Bookmark aria-hidden="true" />
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
              <button
                type="button"
                className={styles.commentsToggle}
                aria-expanded={isCommentsOpen}
                onClick={() => setIsCommentsOpen(current => !current)}
              >
                Comments
                <span>{visibleComments.length}</span>
              </button>
              <CharacterExportButton payload={exportPayload} />
            </div>

            {isCommentsOpen ? (
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
                        {comment.viewerCanDelete ? (
                          <button type="button" aria-label="Delete comment" onClick={() => handleDeleteComment(comment.id)}>
                            <Trash2 aria-hidden="true" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {statsState.error ? <span className="sr-only" role="status">Using fallback hero stats</span> : null}
      </aside>
      <BackstoryModule hero={displayHero} />
    </>
  )
}

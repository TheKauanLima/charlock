'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Bookmark, BookmarkX, ExternalLink, Heart, MessageCircleReply, MessageSquare, RefreshCw, Settings, Trash2, UserCheck, UserPlus, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { CSSProperties } from 'react'
import { useClerk } from '@clerk/nextjs'

import { updateProfileBackground } from '@/app/profile/actions'
import type { CustomHeroSummary } from '@/lib/custom-hero-types'
import type { HeroDefinition } from '@/lib/hero-data'
import type { ProfileCommentsLedger, ProfileCommentItem, ProfileLikeItem } from '@/lib/profile-ledger-types'
import type { ProfileBackgroundVisual, UserProfileData } from '@/lib/profile'
import heroGridStyles from '@/components/HeroGrid/HeroGrid.module.css'

import { ProfileSettingsPanel } from './ProfileSettings'
import styles from './UserProfile.module.css'

interface UserProfileProps {
  data: UserProfileData
  heroes: HeroDefinition[]
}

interface ProfileStyle extends CSSProperties {
  '--profile-accent': string
  '--profile-name': string
}

interface ProfileGridHero {
  id: string
  name: string
  portrait: string
  background: string
  href: string
}

interface ProfileBackgroundOption extends ProfileBackgroundVisual {
  portrait: string
  source: 'Official' | 'Created'
}

interface ActivityFeedItem {
  id: string
  type: 'published_hero' | 'comment'
  createdAt: string
  heroId: string
  heroName: string
  actorId: string
  actorName: string
  content?: string
}

type ProfilePanel = 'saved' | 'bookmarks' | 'likes' | 'comments' | 'notifications' | 'settings'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type CommentsView = 'made' | 'received'
const PROFILE_PANELS: ProfilePanel[] = ['saved', 'bookmarks', 'likes', 'comments', 'notifications', 'settings']

function getPanelFromHash(): ProfilePanel {
  if (typeof window === 'undefined') {
    return 'saved'
  }

  const hash = window.location.hash.replace(/^#/, '')

  if (hash === 'characters-created') {
    return 'saved'
  }

  return PROFILE_PANELS.includes(hash as ProfilePanel) ? hash as ProfilePanel : 'saved'
}

function getInitials(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

function getCreatedHeroes(data: UserProfileData): ProfileGridHero[] {
  const summariesById = new Map(data.savedHeroes.map(hero => [hero.id, hero]))

  return data.authoredHeroes.map(hero => {
    const summary = summariesById.get(hero.id)

    return {
      id: hero.id,
      name: summary?.displayName ?? hero.name,
      portrait: summary?.portrait ?? hero.portrait,
      background: summary?.background ?? hero.render,
      href: data.viewerIsOwner ? `/?tab=create&heroId=${encodeURIComponent(hero.id)}` : `/?tab=browse&heroId=${encodeURIComponent(hero.id)}`,
    }
  })
}

function getBookmarkedHeroes(heroes: CustomHeroSummary[]): ProfileGridHero[] {
  return heroes.map(hero => ({
    id: hero.id,
    name: hero.displayName,
    portrait: hero.portrait,
    background: hero.background,
    href: `/?tab=bookmarks&heroId=${encodeURIComponent(hero.id)}`,
  }))
}

function formatLedgerDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getCommentSnippet(value: string) {
  return value.length > 150 ? `${value.slice(0, 147)}...` : value
}

function getBackgroundOptions(officialHeroes: HeroDefinition[], createdHeroes: CustomHeroSummary[]): ProfileBackgroundOption[] {
  return [
    ...officialHeroes.map(hero => ({
      id: `official:${hero.slug}`,
      label: hero.displayName,
      render: hero.render,
      portrait: hero.portrait,
      accent: hero.heroInfo.tagColor,
      nameColor: hero.heroInfo.nameColor,
      source: 'Official' as const,
    })),
    ...createdHeroes.map(hero => ({
      id: `custom:${hero.id}`,
      label: hero.displayName,
      render: hero.render,
      portrait: hero.portrait,
      accent: hero.heroInfo.tagColor,
      nameColor: hero.heroInfo.nameColor,
      source: 'Created' as const,
    })),
  ]
}

function ProfileHeroGrid({
  heroes,
  emptyMessage,
  onUnbookmark,
  pendingRemovalIds = new Set<string>(),
}: {
  heroes: ProfileGridHero[]
  emptyMessage: string
  onUnbookmark?: (heroId: string) => void
  pendingRemovalIds?: Set<string>
}) {
  if (!heroes.length) {
    return (
      <EmptyState
        icon={BookmarkX}
        title={emptyMessage}
        message="The ledger is quiet for now."
        ctaHref="/"
        ctaLabel="Browse Community Characters"
      />
    )
  }

  return (
    <div className={`${heroGridStyles.grid} ${styles.cardGrid}`}>
      {heroes.map(hero => (
        <article
          key={hero.id}
          className={`${heroGridStyles.browseCard} ${pendingRemovalIds.has(hero.id) ? styles.removingCard : ''}`}
        >
          <Link
            href={hero.href}
            className={heroGridStyles.heroCard}
            aria-label={`Open character ${hero.name}`}
          >
            <span className={heroGridStyles.heroBacker} />
            <span className={heroGridStyles.browseBackground} style={{ backgroundImage: `url('${hero.background}')` }} aria-hidden="true" />
            <span className={heroGridStyles.heroPortraitWrap}>
              <Image
                src={hero.portrait}
                alt={hero.name}
                fill
                className={heroGridStyles.heroPortrait}
                sizes="(max-width: 1024px) 25vw, 12vw"
              />
            </span>
            <span className={heroGridStyles.heroBorder} />
            <span className={heroGridStyles.heroTint} />
            <span className={heroGridStyles.heroNameBadge} aria-hidden="true">
              {hero.name}
            </span>
          </Link>
          {onUnbookmark ? (
            <button
              type="button"
              className={styles.cardIconButton}
              onClick={() => onUnbookmark(hero.id)}
              aria-label={`Remove bookmark for ${hero.name}`}
              disabled={pendingRemovalIds.has(hero.id)}
            >
              <BookmarkX aria-hidden="true" size={16} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  message,
  ctaHref,
  ctaLabel,
}: {
  icon: typeof BookmarkX
  title: string
  message: string
  ctaHref: string
  ctaLabel: string
}) {
  return (
    <div className={styles.emptyState}>
      <Icon aria-hidden="true" size={34} />
      <p>{title}</p>
      <span>{message}</span>
      <Link href={ctaHref}>{ctaLabel}</Link>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.errorState} role="alert">
      <p>Unable to retrieve grid entries. Server link severed.</p>
      <button type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" size={15} />
        Retry Connection
      </button>
    </div>
  )
}

function LedgerSkeleton({ variant = 'list' }: { variant?: 'list' | 'grid' }) {
  const rows = variant === 'grid' ? 8 : 4

  return (
    <div className={variant === 'grid' ? styles.gridSkeleton : styles.listSkeleton} aria-label="Loading profile entries">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

function LikesPanel({
  status,
  likes,
  onRetry,
}: {
  status: LoadStatus
  likes: ProfileLikeItem[]
  onRetry: () => void
}) {
  if (status === 'loading' || status === 'idle') {
    return <LedgerSkeleton />
  }

  if (status === 'error') {
    return <ErrorState onRetry={onRetry} />
  }

  if (!likes.length) {
    return (
      <EmptyState
        icon={Heart}
        title="You have not liked any characters yet."
        message="Liked community characters will appear here."
        ctaHref="/"
        ctaLabel="Browse Community Characters"
      />
    )
  }

  return (
    <div className={styles.ledgerList}>
      {likes.map(like => (
        <article key={like.id} className={styles.ledgerRow}>
          <div>
            <p>{like.heroName}</p>
            <span>By {like.creatorName}</span>
          </div>
          <time dateTime={like.likedAt}>{formatLedgerDate(like.likedAt)}</time>
          <Link href={like.href} aria-label={`View ${like.heroName}`}>
            <ExternalLink aria-hidden="true" size={15} />
            View
          </Link>
        </article>
      ))}
    </div>
  )
}

function CommentsPanel({
  status,
  comments,
  activeView,
  onViewChange,
  onRetry,
  onDelete,
  pendingDeleteId,
}: {
  status: LoadStatus
  comments: ProfileCommentsLedger
  activeView: CommentsView
  onViewChange: (view: CommentsView) => void
  onRetry: () => void
  onDelete: (comment: ProfileCommentItem) => void
  pendingDeleteId: string | null
}) {
  const activeComments = comments[activeView]

  return (
    <div className={styles.commentsPanel}>
      <div className={styles.segmentedControl} role="tablist" aria-label="Comment views">
        <button type="button" role="tab" aria-selected={activeView === 'made'} onClick={() => onViewChange('made')}>
          Comments Made
        </button>
        <button type="button" role="tab" aria-selected={activeView === 'received'} onClick={() => onViewChange('received')}>
          Comments Received
        </button>
      </div>

      {status === 'loading' || status === 'idle' ? <LedgerSkeleton /> : null}
      {status === 'error' ? <ErrorState onRetry={onRetry} /> : null}
      {status === 'ready' && !activeComments.length ? (
        <EmptyState
          icon={MessageSquare}
          title={activeView === 'made' ? 'You have not commented yet.' : 'No comments received yet.'}
          message="Character discussions will be collected here."
          ctaHref="/"
          ctaLabel="Browse Community Characters"
        />
      ) : null}
      {status === 'ready' && activeComments.length ? (
        <div className={styles.ledgerList}>
          {activeComments.map(comment => (
            <article key={comment.id} className={styles.commentRow}>
              <div>
                <p>{comment.heroName}</p>
                <span>{activeView === 'made' ? getCommentSnippet(comment.content) : `${comment.authorName}: ${getCommentSnippet(comment.content)}`}</span>
              </div>
              <time dateTime={comment.createdAt}>{formatLedgerDate(comment.createdAt)}</time>
              <div className={styles.rowActions}>
                <Link href={comment.href} aria-label={`Open comment on ${comment.heroName}`}>
                  <MessageCircleReply aria-hidden="true" size={15} />
                  {activeView === 'made' ? 'Open' : 'Reply'}
                </Link>
                {comment.viewerCanDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(comment)}
                    disabled={pendingDeleteId === comment.id}
                    aria-label={`Delete comment on ${comment.heroName}`}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Delete
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NotificationsPanel({
  status,
  items,
  onRetry,
}: {
  status: LoadStatus
  items: ActivityFeedItem[]
  onRetry: () => void
}) {
  if (status === 'loading' || status === 'idle') {
    return <LedgerSkeleton />
  }

  if (status === 'error') {
    return <ErrorState onRetry={onRetry} />
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications are waiting."
        message="Followed-character activity and comments on your characters will appear here."
        ctaHref="/"
        ctaLabel="Browse Community Characters"
      />
    )
  }

  return (
    <div className={styles.ledgerList}>
      {items.map(item => (
        <article key={item.id} className={styles.notificationRow}>
          <span className={styles.unreadDot} aria-hidden="true" />
          <div>
            <p>{item.actorName}</p>
            <span>{item.type === 'comment' ? `commented on ${item.heroName}` : `published ${item.heroName}`}</span>
          </div>
          <time dateTime={item.createdAt}>{formatLedgerDate(item.createdAt)}</time>
        </article>
      ))}
    </div>
  )
}

function ProfileBackgroundModal({
  options,
  activeId,
  isPending,
  onClose,
  onSelect,
}: {
  options: ProfileBackgroundOption[]
  activeId: string
  isPending: boolean
  onClose: () => void
  onSelect: (option: ProfileBackgroundOption) => void
}) {
  const officialOptions = options.filter(option => option.source === 'Official')
  const createdOptions = options.filter(option => option.source === 'Created')

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.backgroundModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-background-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.backgroundModalHeader}>
          <div>
            <p id="profile-background-title">Profile Background</p>
            <span>{isPending ? 'Saving selection' : 'Choose a character render'}</span>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Close background picker">
            x
          </button>
        </div>

        <div className={styles.backgroundOptionGroups}>
          <div className={styles.backgroundOptionGroup}>
            <span>Main Characters</span>
            <div className={styles.backgroundOptions}>
              {officialOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.backgroundOption} ${activeId === option.id ? styles.backgroundOptionActive : ''}`}
                  onClick={() => onSelect(option)}
                  aria-pressed={activeId === option.id}
                  disabled={isPending}
                >
                  <Image src={option.portrait} alt="" fill sizes="112px" className={styles.backgroundOptionImage} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.backgroundOptionGroup}>
            <span>Created Characters</span>
            {createdOptions.length ? (
              <div className={styles.backgroundOptions}>
                {createdOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.backgroundOption} ${activeId === option.id ? styles.backgroundOptionActive : ''}`}
                    onClick={() => onSelect(option)}
                    aria-pressed={activeId === option.id}
                    disabled={isPending}
                  >
                    <Image src={option.portrait} alt="" fill sizes="112px" className={styles.backgroundOptionImage} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.backgroundEmpty}>No created characters yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default function UserProfile({ data, heroes }: UserProfileProps) {
  const { openUserProfile } = useClerk()
  const [activePanel, setActivePanel] = useState<ProfilePanel>('saved')
  const [isPanelPending, startPanelTransition] = useTransition()
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false)
  const [isBackgroundPending, startBackgroundTransition] = useTransition()
  const [profileBackground, setProfileBackground] = useState<ProfileBackgroundVisual>(data.profileBackground)
  const [bookmarkCards, setBookmarkCards] = useState<ProfileGridHero[]>(() => getBookmarkedHeroes(data.bookmarkedHeroes))
  const [removingBookmarkIds, setRemovingBookmarkIds] = useState<Set<string>>(new Set())
  const [likesStatus, setLikesStatus] = useState<LoadStatus>('idle')
  const [likesLedger, setLikesLedger] = useState<ProfileLikeItem[]>([])
  const [commentsStatus, setCommentsStatus] = useState<LoadStatus>('idle')
  const [commentsLedger, setCommentsLedger] = useState<ProfileCommentsLedger>({ made: [], received: [] })
  const [commentsView, setCommentsView] = useState<CommentsView>('made')
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null)
  const [notificationsStatus, setNotificationsStatus] = useState<LoadStatus>('idle')
  const [notificationItems, setNotificationItems] = useState<ActivityFeedItem[]>([])
  const [isFollowing, setIsFollowing] = useState(data.viewerFollowsUser)
  const [followerCount, setFollowerCount] = useState(data.followerCount)
  const [followStatus, setFollowStatus] = useState<string | null>(null)
  const createdHeroes = useMemo(
    () => getCreatedHeroes(data),
    [data],
  )
  const backgroundOptions = useMemo(
    () => getBackgroundOptions(heroes, data.savedHeroes),
    [data.savedHeroes, heroes],
  )
  const themeStyle: ProfileStyle = {
    '--profile-accent': profileBackground.accent,
    '--profile-name': profileBackground.nameColor,
  }
  const followerLabel = `${followerCount} ${followerCount === 1 ? 'follower' : 'followers'}`
  const navItems: Array<{ id: ProfilePanel; label: string; icon: typeof UsersRound }> = [
    { id: 'saved', label: 'Saved Characters', icon: UsersRound },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { id: 'likes', label: 'Likes', icon: Heart },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const fetchLikes = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(data.user.clerkId)}/likes`, {
        headers: {
          Accept: 'application/json',
        },
      })
      const body = await response.json() as { likes?: ProfileLikeItem[] }

      if (!response.ok || !body.likes) {
        throw new Error(`Likes request failed with ${response.status}`)
      }

      setLikesLedger(body.likes)
      setLikesStatus('ready')
    } catch {
      setLikesStatus('error')
    }
  }, [data.user.clerkId])

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(data.user.clerkId)}/comments`, {
        headers: {
          Accept: 'application/json',
        },
      })
      const body = await response.json() as { comments?: ProfileCommentsLedger }

      if (!response.ok || !body.comments) {
        throw new Error(`Comments request failed with ${response.status}`)
      }

      setCommentsLedger(body.comments)
      setCommentsStatus('ready')
    } catch {
      setCommentsStatus('error')
    }
  }, [data.user.clerkId])

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/feed', {
        headers: {
          Accept: 'application/json',
        },
      })
      const body = await response.json() as { items?: ActivityFeedItem[] }

      if (!response.ok || !body.items) {
        throw new Error(`Notifications request failed with ${response.status}`)
      }

      setNotificationItems(body.items)
      setNotificationsStatus('ready')
    } catch {
      setNotificationsStatus('error')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActivePanel(getPanelFromHash())
    }, 0)

    function handleHashChange() {
      setActivePanel(getPanelFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    if (!isBackgroundModalOpen) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsBackgroundModalOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBackgroundModalOpen])

  useEffect(() => {
    if (activePanel !== 'likes' || likesStatus !== 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchLikes()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [activePanel, fetchLikes, likesStatus])

  useEffect(() => {
    if (activePanel !== 'comments' || commentsStatus !== 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchComments()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [activePanel, commentsStatus, fetchComments])

  useEffect(() => {
    if (activePanel !== 'notifications' || notificationsStatus !== 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchNotifications()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [activePanel, fetchNotifications, notificationsStatus])

  function handlePanelSelect(panel: ProfilePanel) {
    startPanelTransition(() => setActivePanel(panel))

    const hash = panel === 'saved' ? 'characters-created' : panel
    window.history.replaceState(null, '', `#${hash}`)
  }

  function retryLikes() {
    setLikesStatus('loading')
    void fetchLikes()
  }

  function retryComments() {
    setCommentsStatus('loading')
    void fetchComments()
  }

  function retryNotifications() {
    setNotificationsStatus('loading')
    void fetchNotifications()
  }

  function handleProfileBackgroundSelect(option: ProfileBackgroundOption) {
    setProfileBackground(option)
    setIsBackgroundModalOpen(false)

    startBackgroundTransition(async () => {
      try {
        await updateProfileBackground(option.id)
      } catch {
        setProfileBackground(data.profileBackground)
      }
    })
  }

  async function handleFollowToggle() {
    setFollowStatus(null)

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(data.user.clerkId)}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json() as { follow?: { following: boolean; followerCount: number }; error?: string }

      if (!response.ok || !body.follow) {
        throw new Error(body.error || `Follow request failed with ${response.status}`)
      }

      setIsFollowing(body.follow.following)
      setFollowerCount(body.follow.followerCount)
    } catch (error) {
      setFollowStatus(error instanceof Error ? error.message : 'Failed to update follow status.')
    }
  }

  async function handleUnbookmark(heroId: string) {
    setRemovingBookmarkIds(previous => new Set(previous).add(heroId))

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Bookmark request failed with ${response.status}`)
      }

      setBookmarkCards(previous => previous.filter(hero => hero.id !== heroId))
    } catch {
      setRemovingBookmarkIds(previous => {
        const next = new Set(previous)
        next.delete(heroId)

        return next
      })
    }
  }

  async function handleDeleteComment(comment: ProfileCommentItem) {
    setPendingDeleteCommentId(comment.id)

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(comment.heroId)}/comments?commentId=${encodeURIComponent(comment.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Comment delete failed with ${response.status}`)
      }

      setCommentsLedger(previous => ({
        made: previous.made.filter(item => item.id !== comment.id),
        received: previous.received.filter(item => item.id !== comment.id),
      }))
    } finally {
      setPendingDeleteCommentId(null)
    }
  }

  return (
    <main className={styles.shell} style={themeStyle}>
      <Image
        src={profileBackground.render}
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.backgroundRender}
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />

      <section className={styles.content} aria-label={`${data.user.username} profile`}>
        <aside className={styles.sidePanel} aria-label="Profile sections">
          <div className={styles.railIdentity}>
            <div className={styles.railTopline}>
              <Link href="/" className={styles.backButton} aria-label="Back to site">
                <span aria-hidden="true">&lt;</span>
              </Link>
              <div>
                <span>Profile</span>
                <strong>{data.user.username}</strong>
              </div>
            </div>
            <div className={styles.avatar}>
              {data.avatarUrl ? (
                <Image src={data.avatarUrl} alt="" fill unoptimized sizes="132px" className={styles.avatarImage} />
              ) : (
                <span className={styles.avatarFallback}>{getInitials(data.user.username)}</span>
              )}
            </div>
            <div className={styles.sideProfileCopy}>
              <p className={styles.eyebrow}>Welcome Back</p>
              <h1>{data.user.username}</h1>
              <span className={styles.followMeta}>{followerLabel}</span>
              {followStatus ? <span className={styles.followError} role="status">{followStatus}</span> : null}
              {data.viewerIsOwner ? (
                <button type="button" className={styles.avatarEditButton} onClick={() => openUserProfile()}>
                  Edit Picture
                </button>
              ) : null}
            </div>
            {!data.viewerIsOwner ? (
              <button
                type="button"
                className={styles.followButton}
                onClick={handleFollowToggle}
                aria-pressed={isFollowing}
              >
                {isFollowing ? <UserCheck aria-hidden="true" size={16} /> : <UserPlus aria-hidden="true" size={16} />}
                {isFollowing ? 'Following User' : 'Follow User'}
              </button>
            ) : null}
          </div>
          <div className={styles.sidePanelList}>
            {navItems.map(item => {
              const Icon = item.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.sidePanelItem} ${activePanel === item.id ? styles.sidePanelItemActive : ''}`}
                  aria-pressed={activePanel === item.id}
                  onClick={() => handlePanelSelect(item.id)}
                >
                  <Icon aria-hidden="true" size={17} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </aside>

        <div className={styles.profileMain}>
          <div className={styles.panelFrame}>
            {!isPanelPending && activePanel === 'saved' ? (
              <section id="characters-created" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Characters Created</p>
                    <span>{createdHeroes.length} total</span>
                  </div>
                </div>
                {data.viewerIsOwner ? (
                  <section className={styles.backgroundSummary} aria-label="Profile background">
                    <div>
                      <p>Profile Background</p>
                      <span>{profileBackground.label}</span>
                    </div>
                    <button type="button" onClick={() => setIsBackgroundModalOpen(true)}>
                      Change Background
                    </button>
                  </section>
                ) : null}
                <ProfileHeroGrid heroes={createdHeroes} emptyMessage="No characters have been created yet." />
              </section>
            ) : null}

            {isPanelPending ? (
              <LedgerSkeleton variant={activePanel === 'saved' || activePanel === 'bookmarks' ? 'grid' : 'list'} />
            ) : null}

            {!isPanelPending && activePanel === 'bookmarks' ? (
              <section id="bookmarks" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Bookmarks</p>
                    <span>{bookmarkCards.length} total</span>
                  </div>
                </div>
                <ProfileHeroGrid
                  heroes={bookmarkCards}
                  emptyMessage="You have not bookmarked any characters yet."
                  onUnbookmark={handleUnbookmark}
                  pendingRemovalIds={removingBookmarkIds}
                />
              </section>
            ) : null}

            {!isPanelPending && activePanel === 'likes' ? (
              <section id="likes" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Likes</p>
                    <span>{likesStatus === 'ready' ? `${likesLedger.length} total` : 'Retrieving entries'}</span>
                  </div>
                </div>
                <LikesPanel status={likesStatus} likes={likesLedger} onRetry={retryLikes} />
              </section>
            ) : null}

            {!isPanelPending && activePanel === 'comments' ? (
              <section id="comments" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Comments</p>
                    <span>{commentsStatus === 'ready' ? `${commentsLedger.made.length + commentsLedger.received.length} total` : 'Retrieving entries'}</span>
                  </div>
                </div>
                <CommentsPanel
                  status={commentsStatus}
                  comments={commentsLedger}
                  activeView={commentsView}
                  onViewChange={setCommentsView}
                  onRetry={retryComments}
                  onDelete={handleDeleteComment}
                  pendingDeleteId={pendingDeleteCommentId}
                />
              </section>
            ) : null}

            {!isPanelPending && activePanel === 'notifications' ? (
              <section id="notifications" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Notifications</p>
                    <span>{notificationsStatus === 'ready' ? `${notificationItems.length} recent` : 'Retrieving entries'}</span>
                  </div>
                </div>
                <NotificationsPanel status={notificationsStatus} items={notificationItems} onRetry={retryNotifications} />
              </section>
            ) : null}

            {!isPanelPending && activePanel === 'settings' ? (
              <section id="settings" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Settings</p>
                    <span>Profile controls inline</span>
                  </div>
                </div>
                <div className={styles.settingsPanel}>
                  <ProfileSettingsPanel user={data.user} heroes={heroes} embedded />
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      {isBackgroundModalOpen ? (
        <ProfileBackgroundModal
          options={backgroundOptions}
          activeId={profileBackground.id}
          isPending={isBackgroundPending}
          onClose={() => setIsBackgroundModalOpen(false)}
          onSelect={handleProfileBackgroundSelect}
        />
      ) : null}
    </main>
  )
}

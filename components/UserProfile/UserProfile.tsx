'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Bookmark, BookmarkX, Check, Cog, ExternalLink, Heart, MessageCircleReply, MessageSquare, RefreshCw, Settings, Trash2, UserCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { CSSProperties } from 'react'
import { useClerk } from '@clerk/nextjs'

import { updateProfileBackground } from '@/app/profile/actions'
import heroGridStyles from '@/components/HeroGrid/HeroGrid.module.css'
import type { CustomHeroSummary } from '@/lib/custom-hero-types'
import type { HeroDefinition } from '@/lib/hero-data'
import { getThumbnailUrl, IMAGE_BLUR_DATA_URL } from '@/lib/image-optimization'
import type { ProfileCommentsLedger, ProfileCommentItem, ProfileLikeItem } from '@/lib/profile-ledger-types'
import type { ProfileBackgroundVisual, UserProfileData } from '@/lib/profile'

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

interface BackgroundOptionStyle extends CSSProperties {
  '--option-accent': string
  '--option-name': string
}

interface ProfileGridHero {
  id: string
  name: string
  portrait: string
  background: string
  href: string
  likesCount: number
  bookmarkIndex: number
  creatorType: 'Official' | 'Community'
  roleTags: string[]
  restricted?: boolean
}

interface ProfileBackgroundOption extends ProfileBackgroundVisual {
  portrait: string
  source: 'Official' | 'Created'
}

interface ProfileNotificationItem {
  id: string
  type: 'like' | 'comment' | 'follow' | 'publish'
  read: boolean
  createdAt: string
  relativeTime: string
  actorId: string
  actorName: string
  actorInitials: string
  action: string
  targetId: string
  relatedHeroId: string | null
  heroName: string | null
  heroAccent: string
  href: string
}

type ProfilePanel = 'saved' | 'bookmarks' | 'likes' | 'comments' | 'notifications' | 'settings'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type CommentsView = 'made' | 'received'
type BackgroundPickerTab = ProfileBackgroundOption['source']
type BookmarkSort = 'newest' | 'oldest' | 'rating' | 'name'
type BookmarkRoleFilter = 'all' | 'weapon' | 'vitality' | 'spirit'
type BookmarkCreatorFilter = 'all' | 'official' | 'community'
type NotificationFilter = 'all' | 'comment' | 'like' | 'follow'
const PROFILE_PANELS: ProfilePanel[] = ['saved', 'bookmarks', 'likes', 'comments', 'notifications', 'settings']
const BACKGROUND_SYNC_MESSAGE = 'SYSTEM: Profile configuration synchronized successfully.'

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
      likesCount: summary?.likesCount ?? 0,
      bookmarkIndex: 0,
      creatorType: 'Community' as const,
      roleTags: [
        summary?.heroInfo.tag1Text,
        summary?.heroInfo.tag2Text,
        summary?.heroInfo.tag3Text,
      ].filter((tag): tag is string => Boolean(tag)),
      restricted: hero.moderationStatus === 'hidden',
    }
  })
}

function getBookmarkedHeroes(heroes: CustomHeroSummary[]): ProfileGridHero[] {
  return heroes.map((hero, index) => ({
    id: hero.id,
    name: hero.displayName,
    portrait: hero.portrait,
    background: hero.background,
    href: `/?tab=bookmarks&heroId=${encodeURIComponent(hero.id)}`,
    likesCount: hero.likesCount,
    bookmarkIndex: index,
    creatorType: 'Community' as const,
    roleTags: [
      hero.heroInfo.tag1Text,
      hero.heroInfo.tag2Text,
      hero.heroInfo.tag3Text,
    ].filter(Boolean),
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

function getBackgroundOptionById(options: ProfileBackgroundOption[], id: string) {
  return options.find(option => option.id === id)
}

function getSortedBookmarkCards(
  cards: ProfileGridHero[],
  sort: BookmarkSort,
  roleFilter: BookmarkRoleFilter,
  creatorFilter: BookmarkCreatorFilter,
) {
  const filteredCards = cards.filter(card => {
    const matchesCreator = creatorFilter === 'all' || card.creatorType.toLowerCase() === creatorFilter
    const matchesRole = roleFilter === 'all' || card.roleTags.some(tag => tag.toLowerCase().includes(roleFilter))

    return matchesCreator && matchesRole
  })

  return [...filteredCards].sort((left, right) => {
    if (sort === 'oldest') {
      return right.bookmarkIndex - left.bookmarkIndex
    }

    if (sort === 'rating') {
      return right.likesCount - left.likesCount || left.name.localeCompare(right.name)
    }

    if (sort === 'name') {
      return left.name.localeCompare(right.name)
    }

    return left.bookmarkIndex - right.bookmarkIndex
  })
}

function ProfileHeroGrid({
  heroes,
  emptyMessage,
  onUnbookmark,
  onDelete,
  pendingRemovalIds = new Set<string>(),
}: {
  heroes: ProfileGridHero[]
  emptyMessage: string
  onUnbookmark?: (heroId: string) => void
  onDelete?: (hero: ProfileGridHero) => void
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
          className={`${heroGridStyles.browseCard} ${styles.profileHeroCard} ${pendingRemovalIds.has(hero.id) ? styles.removingCard : ''}`}
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
                src={getThumbnailUrl(hero.portrait, 260, 420)}
                alt={hero.name}
                fill
                className={heroGridStyles.heroPortrait}
                sizes="(max-width: 1024px) 25vw, 12vw"
                placeholder="blur"
                blurDataURL={IMAGE_BLUR_DATA_URL}
              />
            </span>
            <span className={heroGridStyles.heroBorder} />
            <span className={heroGridStyles.heroTint} />
            <span className={heroGridStyles.heroNameBadge} aria-hidden="true">
              {hero.name}
            </span>
            {hero.restricted ? (
              <span className={styles.restrictedCardMessage} role="status">
                ALERT: This character has been temporarily restricted due to safety reports and is undergoing review.
              </span>
            ) : null}
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
          {onDelete ? (
            <button
              type="button"
              className={`${styles.cardIconButton} ${styles.cardDeleteButton}`}
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                onDelete(hero)
              }}
              aria-label={`Delete character ${hero.name}`}
              title={`Delete ${hero.name}`}
              disabled={pendingRemovalIds.has(hero.id)}
            >
              <X aria-hidden="true" size={18} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function DeleteHeroConfirmation({ hero, isPending, error, onCancel, onConfirm }: {
  hero: ProfileGridHero
  isPending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={() => { if (!isPending) onCancel() }}>
      <section
        className={styles.deleteHeroModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-hero-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.backgroundModalHeader}>
          <div>
            <p id="delete-hero-title">Delete {hero.name}?</p>
            <span>Permanent database deletion</span>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onCancel} aria-label="Close hero deletion confirmation" disabled={isPending}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className={styles.deleteHeroWarning}>
          This permanently removes the character, its stats, abilities, comments, likes, and bookmarks. This action cannot be undone.
        </p>
        {error ? <p className={styles.deleteHeroError} role="alert">{error}</p> : null}
        <div className={styles.backgroundModalActions}>
          <button type="button" className={styles.backgroundCancelButton} onClick={onCancel} disabled={isPending}>Cancel</button>
          <button type="button" className={styles.deleteHeroConfirmButton} onClick={onConfirm} disabled={isPending}>
            <Trash2 aria-hidden="true" size={15} />
            {isPending ? 'Deleting Character...' : 'Permanently Delete'}
          </button>
        </div>
      </section>
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
  filter,
  pendingReadId,
  isMarkingAllRead,
  onRetry,
  onFilterChange,
  onMarkAllRead,
  onMarkRead,
}: {
  status: LoadStatus
  items: ProfileNotificationItem[]
  filter: NotificationFilter
  pendingReadId: string | null
  isMarkingAllRead: boolean
  onRetry: () => void
  onFilterChange: (filter: NotificationFilter) => void
  onMarkAllRead: () => void
  onMarkRead: (notification: ProfileNotificationItem) => void
}) {
  const unreadCount = items.filter(item => !item.read).length

  return (
    <div className={styles.notificationsPanel}>
      <div className={styles.notificationToolbar}>
        <label>
          <span>Filter</span>
          <select value={filter} onChange={event => onFilterChange(event.target.value as NotificationFilter)}>
            <option value="all">All</option>
            <option value="comment">Comments</option>
            <option value="like">Likes</option>
            <option value="follow">Follows</option>
          </select>
        </label>
        <button type="button" onClick={onMarkAllRead} disabled={!unreadCount || isMarkingAllRead || status !== 'ready'}>
          {isMarkingAllRead ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      <NotificationPanelContent
        status={status}
        items={items}
        pendingReadId={pendingReadId}
        onRetry={onRetry}
        onMarkRead={onMarkRead}
      />
    </div>
  )
}

function NotificationPanelContent({
  status,
  items,
  pendingReadId,
  onRetry,
  onMarkRead,
}: {
  status: LoadStatus
  items: ProfileNotificationItem[]
  pendingReadId: string | null
  onRetry: () => void
  onMarkRead: (notification: ProfileNotificationItem) => void
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
        <article
          key={item.id}
          className={`${styles.notificationRow} ${item.read ? styles.notificationRowRead : ''}`}
          style={{ '--notification-accent': item.heroAccent } as CSSProperties}
        >
          <span className={styles.unreadDot} aria-hidden="true" />
          <span className={styles.notificationAvatar} aria-hidden="true">{item.actorInitials}</span>
          <div>
            <p>{item.actorName}</p>
            <span>{item.action}</span>
          </div>
          <time dateTime={item.createdAt}>{item.relativeTime}</time>
          {!item.read ? (
            <button
              type="button"
              onClick={() => onMarkRead(item)}
              disabled={pendingReadId === item.id}
              aria-label={`Mark notification from ${item.actorName} as read`}
            >
              Mark read
            </button>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function ProfileBackgroundModal({
  options,
  activeId,
  draftId,
  activeTab,
  isPending,
  error,
  onClose,
  onConfirm,
  onPreview,
  onPreviewEnd,
  onSelectDraft,
  onTabChange,
}: {
  options: ProfileBackgroundOption[]
  activeId: string
  draftId: string
  activeTab: BackgroundPickerTab
  isPending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
  onPreview: (option: ProfileBackgroundOption) => void
  onPreviewEnd: () => void
  onSelectDraft: (option: ProfileBackgroundOption) => void
  onTabChange: (tab: BackgroundPickerTab) => void
}) {
  const officialOptions = options.filter(option => option.source === 'Official')
  const createdOptions = options.filter(option => option.source === 'Created')
  const visibleOptions = activeTab === 'Official' ? officialOptions : createdOptions

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
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className={styles.backgroundTabs} role="tablist" aria-label="Background source">
          <button type="button" role="tab" aria-selected={activeTab === 'Official'} onClick={() => onTabChange('Official')} disabled={isPending}>
            Official Characters
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'Created'} onClick={() => onTabChange('Created')} disabled={isPending}>
            My Custom Characters
          </button>
        </div>

        {visibleOptions.length ? (
          <div className={styles.backgroundOptions}>
            {visibleOptions.map(option => {
              const optionStyle: BackgroundOptionStyle = {
                '--option-accent': option.accent,
                '--option-name': option.nameColor,
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.backgroundOption} ${draftId === option.id ? styles.backgroundOptionDraft : ''} ${activeId === option.id ? styles.backgroundOptionActive : ''}`}
                  style={optionStyle}
                  onClick={() => onSelectDraft(option)}
                  onFocus={() => onPreview(option)}
                  onBlur={onPreviewEnd}
                  onMouseEnter={() => onPreview(option)}
                  onMouseLeave={onPreviewEnd}
                  aria-pressed={draftId === option.id}
                  disabled={isPending}
                >
                  <span className={styles.backgroundOptionRender}>
                    <Image src={option.render} alt="" fill sizes="(max-width: 760px) 84vw, 280px" className={styles.backgroundOptionRenderImage} />
                    <span className={styles.backgroundOptionWash} aria-hidden="true" />
                  </span>
                  <span className={styles.backgroundOptionPortrait}>
                    <Image src={getThumbnailUrl(option.portrait, 152, 246)} alt="" fill sizes="76px" className={styles.backgroundOptionPortraitImage} placeholder="blur" blurDataURL={IMAGE_BLUR_DATA_URL} />
                  </span>
                  <span className={styles.backgroundOptionLabel}>{option.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className={styles.backgroundEmpty}>No created characters yet.</p>
        )}

        {error ? <p className={styles.backgroundError} role="alert">{error}</p> : null}

        <div className={styles.backgroundModalActions}>
          <button type="button" className={styles.backgroundCancelButton} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className={styles.backgroundConfirmButton} onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Cog aria-hidden="true" size={15} className={styles.syncGear} />
                COMMITTING MEMORY CORE...
              </>
            ) : (
              <>
                <Check aria-hidden="true" size={15} />
                Confirm Background
              </>
            )}
          </button>
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
  const [savedProfileBackground, setSavedProfileBackground] = useState<ProfileBackgroundVisual>(data.profileBackground)
  const [profileBackground, setProfileBackground] = useState<ProfileBackgroundVisual>(data.profileBackground)
  const [draftProfileBackground, setDraftProfileBackground] = useState<ProfileBackgroundOption | null>(null)
  const [backgroundPickerTab, setBackgroundPickerTab] = useState<BackgroundPickerTab>('Official')
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [backgroundToast, setBackgroundToast] = useState<string | null>(null)
  const [backgroundSynced, setBackgroundSynced] = useState(false)
  const [bookmarkCards, setBookmarkCards] = useState<ProfileGridHero[]>(() => getBookmarkedHeroes(data.bookmarkedHeroes))
  const [createdHeroCards, setCreatedHeroCards] = useState<ProfileGridHero[]>(() => getCreatedHeroes(data))
  const [deletedHeroIds, setDeletedHeroIds] = useState<Set<string>>(new Set())
  const [heroPendingDeletion, setHeroPendingDeletion] = useState<ProfileGridHero | null>(null)
  const [pendingDeleteHeroId, setPendingDeleteHeroId] = useState<string | null>(null)
  const [heroDeleteError, setHeroDeleteError] = useState<string | null>(null)
  const [bookmarkSort, setBookmarkSort] = useState<BookmarkSort>('newest')
  const [bookmarkRoleFilter, setBookmarkRoleFilter] = useState<BookmarkRoleFilter>('all')
  const [bookmarkCreatorFilter, setBookmarkCreatorFilter] = useState<BookmarkCreatorFilter>('all')
  const [removingBookmarkIds, setRemovingBookmarkIds] = useState<Set<string>>(new Set())
  const [likesStatus, setLikesStatus] = useState<LoadStatus>('idle')
  const [likesLedger, setLikesLedger] = useState<ProfileLikeItem[]>([])
  const [commentsStatus, setCommentsStatus] = useState<LoadStatus>('idle')
  const [commentsLedger, setCommentsLedger] = useState<ProfileCommentsLedger>({ made: [], received: [] })
  const [commentsView, setCommentsView] = useState<CommentsView>('made')
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null)
  const [notificationsStatus, setNotificationsStatus] = useState<LoadStatus>('idle')
  const [notificationItems, setNotificationItems] = useState<ProfileNotificationItem[]>([])
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all')
  const [pendingReadNotificationId, setPendingReadNotificationId] = useState<string | null>(null)
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false)
  const [isFollowing, setIsFollowing] = useState(data.viewerFollowsUser)
  const [followerCount, setFollowerCount] = useState(data.followerCount)
  const [followStatus, setFollowStatus] = useState<string | null>(null)
  const backgroundOptions = useMemo(
    () => getBackgroundOptions(heroes, data.savedHeroes.filter(hero => !deletedHeroIds.has(hero.id))),
    [data.savedHeroes, deletedHeroIds, heroes],
  )
  const visibleBookmarkCards = useMemo(
    () => getSortedBookmarkCards(bookmarkCards, bookmarkSort, bookmarkRoleFilter, bookmarkCreatorFilter),
    [bookmarkCards, bookmarkCreatorFilter, bookmarkRoleFilter, bookmarkSort],
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

  const fetchNotifications = useCallback(async (filter: NotificationFilter = notificationFilter) => {
    try {
      const searchParams = new URLSearchParams({
        limit: '40',
      })

      if (filter !== 'all') {
        searchParams.set('type', filter)
      }

      const response = await fetch(`/api/notifications?${searchParams.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      })
      const body = await response.json() as { notifications?: { items?: ProfileNotificationItem[] } }

      if (!response.ok || !body.notifications?.items) {
        throw new Error(`Notifications request failed with ${response.status}`)
      }

      setNotificationItems(body.notifications.items)
      setNotificationsStatus('ready')
    } catch {
      setNotificationsStatus('error')
    }
  }, [notificationFilter])

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
      if (event.key === 'Escape' && !isBackgroundPending) {
        setProfileBackground(savedProfileBackground)
        setDraftProfileBackground(null)
        setIsBackgroundModalOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBackgroundModalOpen, isBackgroundPending, savedProfileBackground])

  useEffect(() => {
    if (!backgroundToast) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setBackgroundToast(null)
    }, 3600)

    return () => window.clearTimeout(timer)
  }, [backgroundToast])

  useEffect(() => {
    if (!backgroundSynced) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setBackgroundSynced(false)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [backgroundSynced])

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

  function handleNotificationFilterChange(filter: NotificationFilter) {
    setNotificationFilter(filter)
    setNotificationsStatus('loading')
    void fetchNotifications(filter)
  }

  async function handleMarkNotificationRead(notification: ProfileNotificationItem) {
    setPendingReadNotificationId(notification.id)

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      })

      if (!response.ok) {
        throw new Error(`Notification update failed with ${response.status}`)
      }

      setNotificationItems(previous => previous.map(item => (
        item.id === notification.id ? { ...item, read: true } : item
      )))
    } finally {
      setPendingReadNotificationId(null)
    }
  }

  async function handleMarkAllNotificationsRead() {
    setIsMarkingAllNotificationsRead(true)

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Notification update failed with ${response.status}`)
      }

      setNotificationItems(previous => previous.map(item => ({ ...item, read: true })))
    } finally {
      setIsMarkingAllNotificationsRead(false)
    }
  }

  function handleBackgroundPickerOpen() {
    const activeOption = getBackgroundOptionById(backgroundOptions, savedProfileBackground.id) ?? backgroundOptions[0]

    if (!activeOption) {
      return
    }

    setDraftProfileBackground(activeOption)
    setBackgroundPickerTab(activeOption.source)
    setProfileBackground(activeOption)
    setBackgroundError(null)
    setIsBackgroundModalOpen(true)
  }

  function handleBackgroundPickerCancel() {
    if (isBackgroundPending) {
      return
    }

    setProfileBackground(savedProfileBackground)
    setDraftProfileBackground(null)
    setBackgroundError(null)
    setIsBackgroundModalOpen(false)
  }

  function handleBackgroundPreview(option: ProfileBackgroundOption) {
    if (!isBackgroundPending) {
      setProfileBackground(option)
    }
  }

  function handleBackgroundPreviewEnd() {
    if (!isBackgroundPending) {
      setProfileBackground(draftProfileBackground ?? savedProfileBackground)
    }
  }

  function handleBackgroundDraftSelect(option: ProfileBackgroundOption) {
    setDraftProfileBackground(option)
    setProfileBackground(option)
    setBackgroundError(null)
  }

  function handleProfileBackgroundConfirm() {
    const option = draftProfileBackground

    if (!option) {
      return
    }

    setProfileBackground(option)

    startBackgroundTransition(async () => {
      try {
        const result = await updateProfileBackground(option.id)

        if ('success' in result) {
          const committedOption = getBackgroundOptionById(backgroundOptions, result.backgroundId) ?? option

          setSavedProfileBackground(committedOption)
          setProfileBackground(committedOption)
          setDraftProfileBackground(null)
          setIsBackgroundModalOpen(false)
          setBackgroundError(null)
          setBackgroundToast(BACKGROUND_SYNC_MESSAGE)
          setBackgroundSynced(true)

          return
        }

        setProfileBackground(savedProfileBackground)
        setBackgroundError(result.error)
      } catch {
        setProfileBackground(savedProfileBackground)
        setBackgroundError('Unable to synchronize profile background.')
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

  function openDeleteHeroConfirmation(hero: ProfileGridHero) {
    setHeroDeleteError(null)
    setHeroPendingDeletion(hero)
  }

  function closeDeleteHeroConfirmation() {
    if (pendingDeleteHeroId) return

    setHeroDeleteError(null)
    setHeroPendingDeletion(null)
  }

  async function handleDeleteHero() {
    const hero = heroPendingDeletion

    if (!hero) return

    setPendingDeleteHeroId(hero.id)
    setHeroDeleteError(null)

    try {
      const response = await fetch(`/api/heroes/${encodeURIComponent(hero.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json() as { deleted?: boolean; error?: string }

      if (!response.ok || !body.deleted) {
        throw new Error(body.error || `Hero deletion failed with ${response.status}`)
      }

      setCreatedHeroCards(previous => previous.filter(card => card.id !== hero.id))
      setBookmarkCards(previous => previous.filter(card => card.id !== hero.id))
      setDeletedHeroIds(previous => new Set(previous).add(hero.id))

      if (savedProfileBackground.id === `custom:${hero.id}`) {
        const fallbackBackground: ProfileBackgroundVisual = {
          id: `official:${data.preferredHero.slug}`,
          label: data.preferredHero.displayName,
          render: data.preferredHero.render,
          accent: data.preferredHero.heroInfo.tagColor,
          nameColor: data.preferredHero.heroInfo.nameColor,
        }

        setSavedProfileBackground(fallbackBackground)
        setProfileBackground(fallbackBackground)
      }

      setHeroPendingDeletion(null)
    } catch (error) {
      setHeroDeleteError(error instanceof Error ? error.message : 'Unable to delete this character.')
    } finally {
      setPendingDeleteHeroId(null)
    }
  }

  return (
    <main className={styles.shell} style={themeStyle}>
      <Image
        src={profileBackground.render}
        alt=""
        fill
        preload
        sizes="100vw"
        className={styles.backgroundRender}
        data-testid="profile-background-render"
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />
      {isBackgroundPending ? <div className={styles.backgroundSyncOverlay} aria-hidden="true" /> : null}

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
          <div className={`${styles.panelFrame} ${backgroundSynced ? styles.panelFrameSynced : ''}`}>
            {!isPanelPending && activePanel === 'saved' ? (
              <section id="characters-created" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Characters Created</p>
                    <span>{createdHeroCards.length} total</span>
                  </div>
                </div>
                {data.viewerIsOwner ? (
                  <section className={styles.backgroundSummary} aria-label="Profile background">
                    <div>
                      <p>Profile Background</p>
                      <span>{profileBackground.label}</span>
                    </div>
                    <button type="button" onClick={handleBackgroundPickerOpen} disabled={isBackgroundPending}>
                      {isBackgroundPending ? (
                        <>
                          <Cog aria-hidden="true" size={15} className={styles.syncGear} />
                          <span>COMMITTING MEMORY CORE...</span>
                        </>
                      ) : (
                        'Change Background'
                      )}
                    </button>
                  </section>
                ) : null}
                <ProfileHeroGrid heroes={createdHeroCards} emptyMessage="No characters have been created yet." onDelete={data.viewerIsOwner ? openDeleteHeroConfirmation : undefined} pendingRemovalIds={pendingDeleteHeroId ? new Set([pendingDeleteHeroId]) : undefined} />
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
                    <span>{visibleBookmarkCards.length} shown / {bookmarkCards.length} total</span>
                  </div>
                </div>
                <div className={styles.bookmarkToolbar} aria-label="Bookmark sorting and filters">
                  <label>
                    <span>Sort by</span>
                    <select value={bookmarkSort} onChange={event => setBookmarkSort(event.target.value as BookmarkSort)}>
                      <option value="newest">Date Added: Newest</option>
                      <option value="oldest">Date Added: Oldest</option>
                      <option value="rating">Rating</option>
                      <option value="name">Character Name</option>
                    </select>
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={bookmarkRoleFilter} onChange={event => setBookmarkRoleFilter(event.target.value as BookmarkRoleFilter)}>
                      <option value="all">All Roles</option>
                      <option value="weapon">Weapon</option>
                      <option value="vitality">Vitality</option>
                      <option value="spirit">Spirit</option>
                    </select>
                  </label>
                  <label>
                    <span>Creator</span>
                    <select value={bookmarkCreatorFilter} onChange={event => setBookmarkCreatorFilter(event.target.value as BookmarkCreatorFilter)}>
                      <option value="all">All Creators</option>
                      <option value="official">Official</option>
                      <option value="community">Community</option>
                    </select>
                  </label>
                </div>
                <ProfileHeroGrid
                  heroes={visibleBookmarkCards}
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
                    <span>{notificationsStatus === 'ready' ? `${notificationItems.filter(item => !item.read).length} unread / ${notificationItems.length} total` : 'Retrieving entries'}</span>
                  </div>
                </div>
                <NotificationsPanel
                  status={notificationsStatus}
                  items={notificationItems}
                  filter={notificationFilter}
                  pendingReadId={pendingReadNotificationId}
                  isMarkingAllRead={isMarkingAllNotificationsRead}
                  onRetry={retryNotifications}
                  onFilterChange={handleNotificationFilterChange}
                  onMarkAllRead={handleMarkAllNotificationsRead}
                  onMarkRead={handleMarkNotificationRead}
                />
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
          activeId={savedProfileBackground.id}
          draftId={draftProfileBackground?.id ?? savedProfileBackground.id}
          activeTab={backgroundPickerTab}
          isPending={isBackgroundPending}
          error={backgroundError}
          onClose={handleBackgroundPickerCancel}
          onConfirm={handleProfileBackgroundConfirm}
          onPreview={handleBackgroundPreview}
          onPreviewEnd={handleBackgroundPreviewEnd}
          onSelectDraft={handleBackgroundDraftSelect}
          onTabChange={setBackgroundPickerTab}
        />
      ) : null}
      {heroPendingDeletion ? (
        <DeleteHeroConfirmation
          hero={heroPendingDeletion}
          isPending={pendingDeleteHeroId === heroPendingDeletion.id}
          error={heroDeleteError}
          onCancel={closeDeleteHeroConfirmation}
          onConfirm={handleDeleteHero}
        />
      ) : null}
      {backgroundToast ? <div className={styles.profileToast} role="status">{backgroundToast}</div> : null}
    </main>
  )
}

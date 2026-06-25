'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Bookmark, Heart, MessageSquare, Settings, UserCheck, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type { CSSProperties } from 'react'
import { useClerk } from '@clerk/nextjs'

import { updateProfileBackground } from '@/app/profile/actions'
import type { CustomHeroSummary } from '@/lib/custom-hero-types'
import type { HeroDefinition } from '@/lib/hero-data'
import type { ProfileBackgroundVisual, UserProfileData } from '@/lib/profile'
import heroGridStyles from '@/components/HeroGrid/HeroGrid.module.css'

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

type ProfilePanel = 'saved' | 'bookmarks' | 'likes' | 'comments' | 'notifications' | 'settings'
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
      href: data.viewerIsOwner ? `/?tab=create&heroId=${encodeURIComponent(hero.id)}` : `/characters/${encodeURIComponent(hero.id)}`,
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

function ProfileHeroGrid({ heroes, emptyMessage }: { heroes: ProfileGridHero[]; emptyMessage: string }) {
  if (!heroes.length) {
    return <p className={styles.emptyLedger}>{emptyMessage}</p>
  }

  return (
    <div className={`${heroGridStyles.grid} ${styles.cardGrid}`}>
      {heroes.map(hero => (
        <article key={hero.id} className={heroGridStyles.browseCard}>
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
        </article>
      ))}
    </div>
  )
}

function EmptyProfilePanel({ title, count, message }: { title: string; count: string; message: string }) {
  return (
    <section className={styles.ledgerPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <p>{title}</p>
          <span>{count}</span>
        </div>
      </div>
      <p className={styles.emptyLedger}>{message}</p>
    </section>
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
  const [activePanel, setActivePanel] = useState<ProfilePanel>(() => getPanelFromHash())
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false)
  const [isBackgroundPending, startBackgroundTransition] = useTransition()
  const [profileBackground, setProfileBackground] = useState<ProfileBackgroundVisual>(data.profileBackground)
  const [isFollowing, setIsFollowing] = useState(data.viewerFollowsUser)
  const [followerCount, setFollowerCount] = useState(data.followerCount)
  const [followStatus, setFollowStatus] = useState<string | null>(null)
  const createdHeroes = useMemo(
    () => getCreatedHeroes(data),
    [data],
  )
  const bookmarkedHeroes = useMemo(
    () => getBookmarkedHeroes(data.bookmarkedHeroes),
    [data.bookmarkedHeroes],
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

  useEffect(() => {
    function handleHashChange() {
      setActivePanel(getPanelFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => window.removeEventListener('hashchange', handleHashChange)
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

  function handlePanelSelect(panel: ProfilePanel) {
    setActivePanel(panel)

    const hash = panel === 'saved' ? 'characters-created' : panel
    window.history.replaceState(null, '', `#${hash}`)
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
            {activePanel === 'saved' ? (
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

            {activePanel === 'bookmarks' ? (
              <section id="bookmarks" className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Bookmarks</p>
                    <span>{bookmarkedHeroes.length} total</span>
                  </div>
                </div>
                <ProfileHeroGrid heroes={bookmarkedHeroes} emptyMessage="No community heroes have been bookmarked yet." />
              </section>
            ) : null}

            {activePanel === 'likes' ? (
              <EmptyProfilePanel title="Likes" count="0 total" message="Liked characters will appear here." />
            ) : null}

            {activePanel === 'comments' ? (
              <EmptyProfilePanel title="Comments" count="0 total" message="Recent comment activity will appear here." />
            ) : null}

            {activePanel === 'notifications' ? (
              <EmptyProfilePanel title="Notifications" count="0 new" message="Profile notifications will appear here." />
            ) : null}

            {activePanel === 'settings' ? (
              <section className={styles.ledgerPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>Settings</p>
                    <span>Profile controls</span>
                  </div>
                </div>
                <div className={styles.settingsPanel}>
                  <p>Edit your main hero, bio, privacy controls, security options, and account settings.</p>
                  <Link href="/profile/settings">Open Settings</Link>
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

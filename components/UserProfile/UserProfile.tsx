'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BarChart3, FileText, ShieldCheck, UserCheck, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import { updatePreferredHero } from '@/app/profile/actions'
import type { HeroDefinition } from '@/lib/hero-data'
import type { UserProfileData } from '@/lib/profile'

import styles from './UserProfile.module.css'

interface UserProfileProps {
  data: UserProfileData
  heroes: HeroDefinition[]
}

interface ProfileStyle extends CSSProperties {
  '--profile-accent': string
  '--profile-name': string
  '--profile-level': string
}

const LEVEL_COLORS = {
  rookie: '#6fb8ff',
  investigator: '#77d474',
  lead: '#e7bd59',
  chief: '#ff5a55',
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getInitials(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

export default function UserProfile({ data, heroes }: UserProfileProps) {
  const router = useRouter()
  const [selectedHeroSlug, setSelectedHeroSlug] = useState(data.preferredHero.slug)
  const [isFollowing, setIsFollowing] = useState(data.viewerFollowsUser)
  const [followerCount, setFollowerCount] = useState(data.followerCount)
  const [followStatus, setFollowStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedHero = useMemo(
    () => heroes.find(hero => hero.slug === selectedHeroSlug) ?? data.preferredHero,
    [data.preferredHero, heroes, selectedHeroSlug],
  )
  const themeStyle: ProfileStyle = {
    '--profile-accent': selectedHero.heroInfo.tagColor,
    '--profile-name': selectedHero.heroInfo.nameColor,
    '--profile-level': LEVEL_COLORS[data.level.tone],
  }

  function handleHeroChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextHero = event.target.value

    setSelectedHeroSlug(nextHero)
    startTransition(async () => {
      await updatePreferredHero(nextHero)
      router.refresh()
    })
  }

  async function handleFollowToggle() {
    setFollowStatus(null)

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(data.user.clerkId)}/follow`, {
        method: 'POST',
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
        src={selectedHero.render}
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.backgroundRender}
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />

      <section className={styles.content} aria-label={`${data.user.username} profile`}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            {data.avatarUrl ? (
              <Image src={data.avatarUrl} alt="" fill unoptimized sizes="156px" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarFallback}>{getInitials(data.user.username)}</span>
            )}
          </div>
          <div className={styles.profileCopy}>
            <p className={styles.eyebrow}>User Profile</p>
            <h1>{data.user.username}</h1>
            <div className={styles.levelLine}>
              <ShieldCheck aria-hidden="true" size={19} />
              <span>{data.level.label}</span>
            </div>
            <time className={styles.timestamp} dateTime={data.user.updatedAt}>
              Last updated {formatTimestamp(data.user.updatedAt)}
            </time>
          </div>

          <div className={styles.profileActions}>
            {data.viewerIsOwner ? (
              <label className={styles.heroSelect}>
                <span>Main Hero</span>
                <select value={selectedHeroSlug} onChange={handleHeroChange} disabled={isPending}>
                  {heroes.map(hero => (
                    <option key={hero.slug} value={hero.slug}>
                      {hero.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!data.viewerIsOwner ? (
              <button
                type="button"
                className={`${styles.homeLink} ${styles.actionButton}`}
                onClick={handleFollowToggle}
                aria-pressed={isFollowing}
              >
                {isFollowing ? <UserCheck aria-hidden="true" size={16} /> : <UserPlus aria-hidden="true" size={16} />}
                {isFollowing ? 'Following User' : 'Follow User'}
              </button>
            ) : null}
            <Link className={styles.homeLink} href="/">
              Main Website
            </Link>
            <span className={styles.followMeta}>{followerCount} followers</span>
            {followStatus ? <span className={styles.followError} role="status">{followStatus}</span> : null}
          </div>
        </div>

        <section className={styles.statsGrid} aria-label="Profile metrics">
          <article className={styles.statBox}>
            <BarChart3 aria-hidden="true" />
            <span>Characters Created</span>
            <strong>{data.charactersCreated}</strong>
          </article>
          <article className={styles.statBox}>
            <FileText aria-hidden="true" />
            <span>User Contributions</span>
            <strong>{data.userContributions}</strong>
          </article>
          <article className={styles.statBox}>
            <ShieldCheck aria-hidden="true" />
            <span>User Progress</span>
            <strong>{data.level.nextAt ? `${data.level.progress}%` : 'MAX'}</strong>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${data.level.progress}%` }} />
            </div>
          </article>
        </section>

        <section className={styles.reportPanel}>
          <div className={styles.sectionHeader}>
            <p>Profile</p>
            {data.viewerIsOwner ? <Link href="/profile/settings">Edit File</Link> : null}
          </div>
          <div className={styles.reportText}>
            {data.user.customBio.split('\n').map((line, index) => (
              <p key={`${line}-${index}`}>{line || '\u00a0'}</p>
            ))}
          </div>
        </section>

        {data.viewerIsOwner ? (
          <section className={styles.ledgerPanel}>
            <div className={styles.sectionHeader}>
              <p>Saved Heroes</p>
              <span>{data.savedHeroes.length} records</span>
            </div>
            {data.savedHeroes.length ? (
              <div className={styles.ledgerGrid}>
                {data.savedHeroes.map(hero => (
                  <Link className={styles.heroCard} key={hero.id} href={`/?tab=create&heroId=${encodeURIComponent(hero.id)}`}>
                    <div className={styles.heroPortrait}>
                      <Image src={hero.portrait} alt="" fill sizes="160px" />
                    </div>
                    <div>
                      <h2>{hero.displayName}</h2>
                      <time className={styles.timestamp} dateTime={hero.updatedAt}>
                        {formatTimestamp(hero.updatedAt)}
                      </time>
                      <span className={styles.statusBadge}>Edit {hero.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.emptyLedger}>No private character drafts have been saved yet.</p>
            )}
          </section>
        ) : null}

        {data.viewerIsOwner ? (
          <section className={styles.ledgerPanel}>
            <div className={styles.sectionHeader}>
              <p>Bookmarks</p>
              <span>{data.bookmarkedHeroes.length} records</span>
            </div>
            {data.bookmarkedHeroes.length ? (
              <div className={styles.ledgerGrid}>
                {data.bookmarkedHeroes.map(hero => (
                  <Link className={styles.heroCard} key={hero.id} href={`/?tab=browse&heroId=${encodeURIComponent(hero.id)}`}>
                    <div className={styles.heroPortrait}>
                      <Image src={hero.portrait} alt="" fill sizes="160px" />
                    </div>
                    <div>
                      <h2>{hero.displayName}</h2>
                      <time className={styles.timestamp} dateTime={hero.updatedAt}>
                        {formatTimestamp(hero.updatedAt)}
                      </time>
                      <span className={styles.statusBadge}>Bookmark</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.emptyLedger}>No community heroes have been bookmarked yet.</p>
            )}
          </section>
        ) : null}

        <section className={styles.ledgerPanel}>
          <div className={styles.sectionHeader}>
            <p>My Characters</p>
            <span>{data.authoredHeroes.length} records</span>
          </div>
          {data.authoredHeroes.length ? (
            <div className={styles.ledgerGrid}>
              {data.authoredHeroes.map(hero => (
                <article className={styles.heroCard} key={hero.id}>
                  <div className={styles.heroPortrait}>
                    <Image src={hero.portrait} alt="" fill sizes="160px" />
                  </div>
                  <div>
                    <h2>{hero.name}</h2>
                    <time className={styles.timestamp} dateTime={hero.updatedAt}>
                      {formatTimestamp(hero.updatedAt)}
                    </time>
                    <span className={styles.statusBadge}>{hero.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyLedger}>No modified hero records have been created by this user.</p>
          )}
        </section>
      </section>
    </main>
  )
}

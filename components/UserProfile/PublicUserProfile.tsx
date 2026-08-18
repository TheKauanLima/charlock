import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import heroGridStyles from '@/components/HeroGrid/HeroGrid.module.css'
import { getThumbnailUrl, IMAGE_BLUR_DATA_URL } from '@/lib/image-optimization'
import type { UserProfileData } from '@/lib/profile'

import PublicProfileFollowButton from './PublicProfileFollowButton'
import styles from './PublicUserProfile.module.css'

interface PublicUserProfileProps {
  data: UserProfileData
}

function getInitials(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

export default function PublicUserProfile({ data }: PublicUserProfileProps) {
  return (
    <main
      className={styles.shell}
      style={{
        '--public-profile-accent': data.profileBackground.accent,
        '--public-profile-name': data.profileBackground.nameColor,
      } as CSSProperties}
    >
      <Image
        src={data.profileBackground.render}
        alt=""
        fill
        preload
        sizes="100vw"
        className={styles.backgroundRender}
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.profileHeader}>
          <Link href="/?tab=browse" className={styles.backLink}>
            <span aria-hidden="true">&lt;</span>
            Back to Browse
          </Link>

          <div className={styles.identity}>
            <div className={styles.avatar}>
              {data.avatarUrl ? (
                <Image src={data.avatarUrl} alt="" fill unoptimized sizes="112px" className={styles.avatarImage} />
              ) : (
                <span>{getInitials(data.user.username)}</span>
              )}
            </div>
            <div className={styles.identityCopy}>
              <p>Public Creator Profile</p>
              <h1>{data.user.username}</h1>
            </div>
            <PublicProfileFollowButton
              userId={data.user.clerkId}
              username={data.user.username}
              initialFollowing={data.viewerFollowsUser}
              initialFollowerCount={data.followerCount}
            />
          </div>
        </header>

        <section className={styles.profileSummary} aria-label={`${data.user.username} public profile summary`}>
          <article className={styles.bioPanel}>
            <p>Creator Record</p>
            <h2>About</h2>
            <span>{data.user.customBio}</span>
          </article>

          <dl className={styles.statsGrid}>
            <div>
              <dt>Characters Created</dt>
              <dd>{data.charactersCreated}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.charactersPanel} aria-labelledby="public-characters-heading">
          <header>
            <div>
              <p>Published Collection</p>
              <h2 id="public-characters-heading">Characters by {data.user.username}</h2>
            </div>
            <span>{data.authoredHeroes.length} public</span>
          </header>

          {data.authoredHeroes.length ? (
            <div className={`${heroGridStyles.grid} ${styles.characterGrid}`}>
              {data.authoredHeroes.map(hero => (
                <article key={hero.id} className={`${heroGridStyles.browseCard} ${styles.characterCard}`}>
                  <Link
                    href={`/?tab=browse&heroId=${encodeURIComponent(hero.id)}`}
                    className={heroGridStyles.heroCard}
                    aria-label={`Open character ${hero.name}`}
                  >
                    <span className={heroGridStyles.heroBacker} />
                    <span
                      className={heroGridStyles.browseBackground}
                      data-testid={`public-hero-background-${hero.id}`}
                      style={{ backgroundImage: `url('${hero.background}')` }}
                      aria-hidden="true"
                    />
                    <span className={heroGridStyles.heroPortraitWrap}>
                      <Image
                        src={getThumbnailUrl(hero.portrait, 260, 420)}
                        alt={hero.name}
                        fill
                        className={heroGridStyles.heroPortrait}
                        sizes="(max-width: 760px) 42vw, 156px"
                        placeholder="blur"
                        blurDataURL={IMAGE_BLUR_DATA_URL}
                      />
                    </span>
                    <span className={heroGridStyles.heroBorder} />
                    <span className={heroGridStyles.heroTint} />
                    <span className={heroGridStyles.heroNameBadge} aria-hidden="true">{hero.name}</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No published characters yet.</p>
              <span>This creator has not shared a character with the community.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

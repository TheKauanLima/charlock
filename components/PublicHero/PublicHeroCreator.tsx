import Image from 'next/image'
import Link from 'next/link'

import type { PublicCreator } from '@/lib/public-page-types'

import styles from './PublicHero.module.css'

export default function PublicHeroCreator({ creator }: { creator: PublicCreator }) {
  return (
    <p className={styles.creator}>
      {creator.avatarUrl ? (
        <span className={styles.creatorAvatar}>
          <Image src={creator.avatarUrl} alt="" fill sizes="32px" />
        </span>
      ) : null}
      <span>
        By{' '}
        {creator.profilePath ? (
          <Link href={creator.profilePath} className={styles.creatorLink}>{creator.username}</Link>
        ) : (
          <span className={styles.creatorName}>{creator.username}</span>
        )}
      </span>
      <span className={styles.creatorLevel}>{creator.level}</span>
    </p>
  )
}

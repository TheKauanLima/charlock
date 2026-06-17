import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import { HEROES } from '@/lib/hero-data'

import styles from './UserProfile.module.css'

interface ProfileUnavailableStyle extends CSSProperties {
  '--profile-accent': string
  '--profile-name': string
  '--profile-level': string
}

export default function ProfileUnavailable() {
  const fallbackHero = HEROES[0]
  const themeStyle: ProfileUnavailableStyle = {
    '--profile-accent': fallbackHero.heroInfo.tagColor,
    '--profile-name': fallbackHero.heroInfo.nameColor,
    '--profile-level': '#6fb8ff',
  }

  return (
    <main
      className={styles.shell}
      style={themeStyle}
    >
      <Image
        src={fallbackHero.render}
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.backgroundRender}
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />
      <section className={styles.unavailablePanel}>
        <p className={styles.eyebrow}>Profile</p>
        <h1>Profile unavailable</h1>
        <p>
          Profile data could not be loaded right now. Check the database connection and try again.
        </p>
        <Link href="/" className={styles.homeLink}>
          Back to characters
        </Link>
      </section>
    </main>
  )
}

'use client'

import { Search } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'

import { HEROES } from '@/lib/hero-data'

import styles from './UserProfile.module.css'

interface ProfileUnavailableStyle extends CSSProperties {
  '--profile-accent': string
  '--profile-name': string
  '--profile-level': string
}

export default function ProfileUnavailable({ reason = 'temporary' }: { reason?: 'missing' | 'private' | 'temporary' }) {
  const router = useRouter()
  const [creatorSearch, setCreatorSearch] = useState('')
  const fallbackHero = HEROES[0]
  const themeStyle: ProfileUnavailableStyle = {
    '--profile-accent': fallbackHero.heroInfo.tagColor,
    '--profile-name': fallbackHero.heroInfo.nameColor,
    '--profile-level': '#6fb8ff',
  }
  const message = reason === 'private'
    ? 'This creator has limited profile access.'
    : reason === 'missing'
      ? 'No creator profile matches this address.'
      : 'Profile data could not be loaded right now. Check the connection and try again.'

  function searchCreators(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = creatorSearch.trim()

    if (query) router.push(`/profile/${encodeURIComponent(query)}`)
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
        preload
        sizes="100vw"
        className={styles.backgroundRender}
      />
      <div className={styles.noiseLayer} aria-hidden="true" />
      <div className={styles.washLayer} aria-hidden="true" />
      <section className={styles.unavailablePanel}>
        <p className={styles.eyebrow}>Profile</p>
        <h1>Profile unavailable</h1>
        <p>{message}</p>
        <form className={styles.creatorSearch} onSubmit={searchCreators}>
          <label htmlFor="creator-profile-search">Find another creator</label>
          <span>
            <Search aria-hidden="true" />
            <input id="creator-profile-search" type="search" value={creatorSearch} onChange={event => setCreatorSearch(event.target.value)} placeholder="Creator username" />
            <button type="submit">Search</button>
          </span>
        </form>
        <Link href="/" className={styles.homeLink}>
          Back to characters
        </Link>
      </section>
    </main>
  )
}

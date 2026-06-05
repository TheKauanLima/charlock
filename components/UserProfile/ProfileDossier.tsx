'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BarChart3, FileText, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import { updatePreferredHero } from '@/app/profile/actions'
import type { HeroDefinition } from '@/lib/hero-data'
import type { ProfileDossierData } from '@/lib/profile'

import styles from './ProfileDossier.module.css'

interface ProfileDossierProps {
  data: ProfileDossierData
  heroes: HeroDefinition[]
}

interface ProfileStyle extends CSSProperties {
  '--profile-accent': string
  '--profile-name': string
  '--profile-rank': string
}

const RANK_COLORS = {
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

export default function ProfileDossier({ data, heroes }: ProfileDossierProps) {
  const router = useRouter()
  const [selectedHeroSlug, setSelectedHeroSlug] = useState(data.preferredHero.slug)
  const [isPending, startTransition] = useTransition()
  const selectedHero = useMemo(
    () => heroes.find(hero => hero.slug === selectedHeroSlug) ?? data.preferredHero,
    [data.preferredHero, heroes, selectedHeroSlug],
  )
  const themeStyle: ProfileStyle = {
    '--profile-accent': selectedHero.heroInfo.tagColor,
    '--profile-name': selectedHero.heroInfo.nameColor,
    '--profile-rank': RANK_COLORS[data.rank.tone],
  }

  function handleHeroChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextHero = event.target.value

    setSelectedHeroSlug(nextHero)
    startTransition(async () => {
      await updatePreferredHero(nextHero)
      router.refresh()
    })
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

      <section className={styles.content} aria-label={`${data.user.username} dossier`}>
        <div className={styles.identityPanel}>
          <div className={styles.avatar}>
            {data.avatarUrl ? (
              <Image src={data.avatarUrl} alt="" fill unoptimized sizes="156px" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarFallback}>{getInitials(data.user.username)}</span>
            )}
          </div>
          <div className={styles.identityCopy}>
            <p className={styles.eyebrow}>Detective Dossier</p>
            <h1>{data.user.username}</h1>
            <div className={styles.rankLine}>
              <ShieldCheck aria-hidden="true" size={19} />
              <span>{data.rank.label}</span>
            </div>
            <time className={styles.timestamp} dateTime={data.user.updatedAt}>
              Last updated {formatTimestamp(data.user.updatedAt)}
            </time>
          </div>

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
        </div>

        <section className={styles.statsGrid} aria-label="Dossier metrics">
          <article className={styles.statBox}>
            <BarChart3 aria-hidden="true" />
            <span>Cases Closed</span>
            <strong>{data.casesClosed}</strong>
          </article>
          <article className={styles.statBox}>
            <FileText aria-hidden="true" />
            <span>Intelligence Reports</span>
            <strong>{data.intelligenceReports}</strong>
          </article>
          <article className={styles.statBox}>
            <ShieldCheck aria-hidden="true" />
            <span>Field Experience</span>
            <strong>{data.rank.nextAt ? `${data.rank.progress}%` : 'MAX'}</strong>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${data.rank.progress}%` }} />
            </div>
          </article>
        </section>

        <section className={styles.reportPanel}>
          <div className={styles.sectionHeader}>
            <p>Dossier</p>
            {data.viewerIsOwner ? <Link href="/profile/settings">Edit File</Link> : null}
          </div>
          <div className={styles.reportText}>
            {data.user.customBio.split('\n').map((line, index) => (
              <p key={`${line}-${index}`}>{line || '\u00a0'}</p>
            ))}
          </div>
        </section>

        <section className={styles.ledgerPanel}>
          <div className={styles.sectionHeader}>
            <p>Contribution Ledger</p>
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
            <p className={styles.emptyLedger}>No modified hero records have been filed by this detective.</p>
          )}
        </section>
      </section>
    </main>
  )
}

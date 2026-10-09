import Link from 'next/link'
import type { CSSProperties } from 'react'

import { serializeJsonLd } from '@/lib/json-ld'
import type { PublicHeroPageData } from '@/lib/public-page-types'
import { buildHeroJsonLd } from '@/lib/public-page-utils'
import { getSiteUrl } from '@/lib/site-url'

import PublicHeroAbilities from './PublicHeroAbilities'
import PublicHeroBackstory from './PublicHeroBackstory'
import PublicHeroComments from './PublicHeroComments'
import PublicHeroHeader from './PublicHeroHeader'
import PublicHeroStatPanels from './PublicHeroStatPanels'
import PublicHeroVisibilityBanner from './PublicHeroVisibilityBanner'
import styles from './PublicHero.module.css'

export default function PublicHeroPage({ data }: { data: PublicHeroPageData }) {
  const { hero, creator, comments, viewer, visibility, description } = data
  const isPublic = visibility === 'public'
  const jsonLd = isPublic
    ? serializeJsonLd(buildHeroJsonLd({ hero, creator, description, siteUrl: getSiteUrl() }))
    : null

  return (
    <main
      className={styles.shell}
      style={{
        '--public-hero-accent': hero.heroInfo.tagColor,
        '--public-hero-accent-text': hero.heroInfo.tagTextColor,
        '--public-hero-name': hero.heroInfo.nameColor,
      } as CSSProperties}
    >
      <div className={styles.content}>
        <Link href="/?tab=browse" className={styles.backLink}>
          <span aria-hidden="true">&lt;</span>
          Back to Browse
        </Link>

        <PublicHeroVisibilityBanner visibility={visibility} />
        <PublicHeroHeader data={data} />
        <PublicHeroAbilities hero={hero} />
        <PublicHeroBackstory backstory={hero.heroInfo.backstory} />
        <PublicHeroStatPanels hero={hero} />
        {isPublic ? <PublicHeroComments heroId={hero.id} comments={comments} isSignedIn={viewer.isSignedIn} /> : null}
      </div>

      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
    </main>
  )
}

import Image from 'next/image'
import type { CSSProperties } from 'react'

import type { PublicHeroPageData } from '@/lib/public-page-types'
import { getHeroTags } from '@/lib/public-page-utils'

import PublicHeroActions from './PublicHeroActions'
import PublicHeroCreator from './PublicHeroCreator'
import { getDisplayImageSrc, getRenderObjectPosition } from './public-hero-utils'
import styles from './PublicHero.module.css'

export default function PublicHeroHeader({ data }: { data: PublicHeroPageData }) {
  const { hero, creator, viewer, visibility } = data
  const portrait = getDisplayImageSrc(hero.portrait)
  const render = getDisplayImageSrc(hero.render)
  const background = getDisplayImageSrc(hero.background)
  const tags = getHeroTags(hero.heroInfo)

  return (
    <header className={styles.header}>
      <div
        className={styles.stage}
        style={background ? { backgroundImage: `url('${background}')` } as CSSProperties : undefined}
      >
        {render ? (
          <Image
            src={render}
            alt={`${hero.displayName} render`}
            fill
            preload
            sizes="(max-width: 860px) 100vw, 55vw"
            className={styles.stageRender}
            style={hero.renderPosition ? { objectPosition: getRenderObjectPosition(hero.renderPosition) } : undefined}
          />
        ) : null}
      </div>

      <div className={styles.identity}>
        {portrait ? (
          <div className={styles.portrait}>
            <Image src={portrait} alt={`${hero.displayName} portrait`} fill sizes="132px" className={styles.portraitImage} />
          </div>
        ) : null}

        <p className={styles.eyebrow}>Deadlock hero concept</p>
        <h1 className={styles.heroName}>{hero.displayName}</h1>

        {tags.length ? (
          <ul className={styles.tags} aria-label="Hero tags">
            {tags.map((tag, index) => (
              <li key={`${index}-${tag}`}>{tag}</li>
            ))}
          </ul>
        ) : null}

        <PublicHeroCreator creator={creator} />

        <PublicHeroActions
          heroId={hero.id}
          heroName={hero.displayName}
          likesCount={hero.likesCount}
          allowCopies={hero.allowCopies}
          viewer={viewer}
          visibility={visibility}
        />
      </div>
    </header>
  )
}

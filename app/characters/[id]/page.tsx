import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  buildCharacterExportPayload,
  getAbsoluteAssetUrl,
  getCharacterShareUrl,
  getSiteOrigin,
} from '@/lib/character-export'
import { CustomHeroError, getPublishedCustomHero } from '@/lib/custom-heroes'

import styles from './page.module.css'

interface CharacterSharePageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamic = 'force-dynamic'

async function getSharedHero(id: string) {
  try {
    return await getPublishedCustomHero(id)
  } catch (error) {
    if (error instanceof CustomHeroError && error.status === 404) {
      notFound()
    }

    throw error
  }
}

export async function generateMetadata({ params }: CharacterSharePageProps): Promise<Metadata> {
  const { id } = await params
  const hero = await getSharedHero(id)
  const origin = getSiteOrigin()
  const title = `${hero.displayName} | Charlock`
  const description = `${hero.displayName} character card with tags ${[
    hero.heroInfo.tag1Text,
    hero.heroInfo.tag2Text,
    hero.heroInfo.tag3Text,
  ].filter(Boolean).join(', ')}.`
  const shareUrl = getCharacterShareUrl(hero.id, origin)
  const imageUrl = `${shareUrl}/opengraph-image`

  return {
    title,
    description,
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: 'Charlock',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${hero.displayName} character card`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function CharacterSharePage({ params }: CharacterSharePageProps) {
  const { id } = await params
  const hero = await getSharedHero(id)
  const payload = buildCharacterExportPayload(hero, hero.stats, {
    shareUrl: getCharacterShareUrl(hero.id, getSiteOrigin()),
  })

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} style={{ backgroundImage: `url('${getAbsoluteAssetUrl(payload.render)}')` }} />
      <section className={styles.card} aria-label={`${payload.name} character card`}>
        <div className={styles.portrait} role="img" aria-label={`${payload.name} portrait`} style={{ backgroundImage: `url('${getAbsoluteAssetUrl(payload.portrait)}')` }} />
        <div className={styles.details}>
          <p>Charlock Character Card</p>
          <h1>{payload.name}</h1>
          <div className={styles.tags} aria-label="Character tags">
            {payload.tags.map(tag => (
              <span key={tag} style={{ backgroundColor: payload.tagColor, color: payload.tagTextColor }}>{tag}</span>
            ))}
          </div>
          <dl className={styles.stats}>
            {payload.stats.map(stat => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.actions}>
            <Link href={`/?tab=browse&heroId=${encodeURIComponent(hero.id)}`}>Open in Charlock</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'

import type { PublicHeroMetadata } from '@/lib/public-page-types'
import { getPublicHeroForMetadata, isValidHeroSlug, loadOgImageDataUrl } from '@/lib/public-pages'
import { SITE_NAME } from '@/lib/site-metadata'

export const alt = 'Hero concept on Cursed Concepts'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Reads the database; caching would keep serving a hero after it goes private.
export const dynamic = 'force-dynamic'

const ACCENT = '#33DEBB'
const BACKGROUND = '#07090b'
const TEXT = '#ffefd6'
const MAX_OG_TAGS = 3

interface ImageProps {
  params: Promise<{ slug: string }>
}

function GenericCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BACKGROUND,
        borderBottom: `12px solid ${ACCENT}`,
        color: ACCENT,
        fontSize: 84,
        letterSpacing: 2,
      }}
    >
      {SITE_NAME}
    </div>
  )
}

function HeroCard({ hero, portrait }: { hero: PublicHeroMetadata; portrait: string | null }) {
  const tags = hero.tags.slice(0, MAX_OG_TAGS)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '48px 64px',
        backgroundColor: BACKGROUND,
        borderBottom: `12px solid ${ACCENT}`,
        color: TEXT,
      }}
    >
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portrait}
          alt=""
          width={318}
          height={514}
          style={{ objectFit: 'cover', border: `4px solid ${ACCENT}`, borderRadius: 8 }}
        />
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', color: ACCENT, fontSize: 28, letterSpacing: 4, textTransform: 'uppercase' }}>
          Deadlock hero concept
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            maxHeight: 260,
            overflow: 'hidden',
            fontSize: portrait ? 76 : 92,
            lineHeight: 1.05,
            fontWeight: 700,
          }}
        >
          {hero.displayName}
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: 'rgba(255, 239, 214, 0.78)' }}>
          {`By ${hero.creator.username}`}
        </div>
        {tags.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 30 }}>
            {tags.map((tag, index) => (
              <div
                key={`${index}-${tag}`}
                style={{
                  display: 'flex',
                  padding: '8px 18px',
                  backgroundColor: ACCENT,
                  color: BACKGROUND,
                  fontSize: 24,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 30, color: ACCENT, fontSize: 30, letterSpacing: 2 }}>
          {SITE_NAME}
        </div>
      </div>
    </div>
  )
}

/**
 * Renders fully before responding, so a satori/resvg failure (for example an
 * undecodable portrait) is caught here instead of breaking the response stream.
 * Returns null on failure.
 */
async function tryRenderImage(element: ReactElement, status = 200): Promise<Response | null> {
  try {
    const image = new ImageResponse(element, { ...size, status })
    const body = await image.arrayBuffer()

    return new Response(body, { status: image.status, headers: image.headers })
  } catch {
    return null
  }
}

async function loadPublicHero(slug: string): Promise<PublicHeroMetadata | null> {
  if (!isValidHeroSlug(slug)) return null

  try {
    return await getPublicHeroForMetadata(slug)
  } catch {
    return null
  }
}

export default async function Image({ params }: ImageProps): Promise<Response> {
  const { slug } = await params
  const hero = await loadPublicHero(slug)
  const genericCard = <GenericCard />

  // Missing, invalid, non-public, or unreadable: a generic card with no hero data.
  if (!hero) {
    return await tryRenderImage(genericCard, 404) ?? new Response(null, { status: 404 })
  }

  // null for unsafe hosts, .webp, oversized files, or fetch errors.
  const portrait = await loadOgImageDataUrl(hero.portrait)
  const portraitCard = portrait ? <HeroCard hero={hero} portrait={portrait} /> : null
  const textCard = <HeroCard hero={hero} portrait={null} />

  return (portraitCard ? await tryRenderImage(portraitCard) : null)
    ?? await tryRenderImage(textCard)
    ?? await tryRenderImage(genericCard)
    ?? new Response(null, { status: 404 })
}

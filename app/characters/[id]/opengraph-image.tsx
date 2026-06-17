import { ImageResponse } from 'next/og'

import {
  CHARACTER_CARD_HEIGHT,
  CHARACTER_CARD_WIDTH,
  buildCharacterExportPayload,
  getAbsoluteAssetUrl,
  getSiteOrigin,
} from '@/lib/character-export'
import { getPublishedCustomHero } from '@/lib/custom-heroes'

interface CharacterOpenGraphImageProps {
  params: Promise<{
    id: string
  }>
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const alt = 'Charlock character card'
export const size = {
  width: CHARACTER_CARD_WIDTH,
  height: CHARACTER_CARD_HEIGHT,
}
export const contentType = 'image/png'

export default async function CharacterOpenGraphImage({ params }: CharacterOpenGraphImageProps) {
  const { id } = await params
  const hero = await getPublishedCustomHero(id)
  const origin = getSiteOrigin()
  const payload = buildCharacterExportPayload(hero, hero.stats)
  const accentColor = payload.accentColor || '#2fc890'

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          background: '#080706',
          color: '#ffefd6',
          fontFamily: 'Arial',
        }}
      >
        <img
          src={getAbsoluteAssetUrl(payload.render, origin)}
          alt=""
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 760,
            height: 630,
            objectFit: 'cover',
            opacity: 0.36,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: 'linear-gradient(90deg, rgba(4,6,5,0.98) 0%, rgba(4,6,5,0.86) 42%, rgba(4,6,5,0.34) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 42,
            width: '100%',
            height: '100%',
            padding: '58px 72px 62px',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 356,
              height: 445,
              overflow: 'hidden',
              border: `2px solid ${accentColor}`,
              background: '#050605',
              boxShadow: '0 28px 70px rgba(0,0,0,0.48)',
            }}
          >
            <img
              src={getAbsoluteAssetUrl(payload.portrait, origin)}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
              gap: 22,
            }}
          >
            <div
              style={{
                color: accentColor,
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Charlock Character Card
            </div>
            <div
              style={{
                color: '#ffefd6',
                fontSize: 86,
                fontWeight: 900,
                lineHeight: 0.88,
                textTransform: 'uppercase',
                maxWidth: 640,
              }}
            >
              {payload.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {payload.tags.map(tag => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    maxWidth: 280,
                    minHeight: 38,
                    alignItems: 'center',
                    overflow: 'hidden',
                    background: payload.tagColor,
                    color: payload.tagTextColor,
                    padding: '10px 16px',
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {payload.stats.map(stat => (
                <div
                  key={stat.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 128,
                    gap: 7,
                    borderTop: `2px solid ${accentColor}`,
                    background: 'rgba(255,239,214,0.07)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      color: 'rgba(255,239,214,0.58)',
                      fontSize: 15,
                      fontWeight: 900,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat.label}
                  </div>
                  <div style={{ color: '#ffefd6', fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 28,
            bottom: 22,
            color: 'rgba(255,239,214,0.5)',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {payload.watermark}
        </div>
      </div>
    ),
    size,
  )
}

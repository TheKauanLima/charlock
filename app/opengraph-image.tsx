import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

import { SITE_NAME } from '@/lib/site-metadata'

export const alt = `${SITE_NAME}: fan-made Deadlock hero concepts`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ACCENT = '#33DEBB'

export default async function Image(): Promise<ImageResponse> {
  const banner = await readFile(join(process.cwd(), 'public/landing/banner.png'))
  const bannerSrc = `data:image/png;base64,${banner.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#07090b',
          borderBottom: `12px solid ${ACCENT}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerSrc}
          alt=""
          width={1100}
          height={373}
          style={{ objectFit: 'cover', borderRadius: 8 }}
        />
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 84,
            letterSpacing: 2,
            color: ACCENT,
          }}
        >
          {SITE_NAME}
        </div>
      </div>
    ),
    { ...size },
  )
}

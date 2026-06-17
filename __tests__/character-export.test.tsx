// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import {
  CHARACTER_CARD_HEIGHT,
  CHARACTER_CARD_WIDTH,
  buildCharacterExportPayload,
  getCharacterShareUrl,
} from '@/lib/character-export'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

const imageMocks = vi.hoisted(() => ({
  toPng: vi.fn(),
}))

vi.mock('html-to-image', () => ({
  toPng: imageMocks.toPng,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('character export cards', () => {
  it('builds a shareable character card payload with key stats', () => {
    const hero = HEROES[0]
    const stats = buildHeroStatsSeed(hero)
    const payload = buildCharacterExportPayload(hero, stats, {
      shareUrl: getCharacterShareUrl('hero_1', 'https://charlock.test'),
    })

    expect(payload.name).toBe(hero.displayName)
    expect(payload.portrait).toBe(hero.portrait)
    expect(payload.tags).toEqual([
      hero.heroInfo.tag1Text,
      hero.heroInfo.tag2Text,
      hero.heroInfo.tag3Text,
    ])
    expect(payload.stats.map(stat => stat.label)).toEqual(['DPS', 'Health', 'Spirit', 'Bullet'])
    expect(payload.shareUrl).toBe('https://charlock.test/characters/hero_1')
    expect(payload.watermark).toBe('charlock.app')
  })

  it('shows a generated preview and downloads the PNG card', async () => {
    const user = userEvent.setup()
    const hero = HEROES[0]
    const payload = buildCharacterExportPayload(hero, buildHeroStatsSeed(hero), {
      shareUrl: 'https://charlock.test/characters/hero_1',
    })
    const clickMock = vi.fn()
    const anchor = {
      href: '',
      download: '',
      click: clickMock,
    } as unknown as HTMLAnchorElement
    const writeTextMock = vi.fn().mockResolvedValue(undefined)

    imageMocks.toPng.mockResolvedValue('data:image/png;base64,card')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    })

    render(<CharacterExportButton payload={payload} />)

    await user.click(screen.getByRole('button', { name: /export character/i }))

    expect(screen.getByRole('dialog', { name: 'Export character card' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Preview ready.')
    expect(imageMocks.toPng).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      width: CHARACTER_CARD_WIDTH,
      height: CHARACTER_CARD_HEIGHT,
      backgroundColor: '#080706',
    }))

    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    await user.click(screen.getByRole('button', { name: /download png/i }))

    expect(clickMock).toHaveBeenCalled()
    expect(anchor.download).toBe('abrams-charlock-card.png')

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith('https://charlock.test/characters/hero_1'))
  })
})

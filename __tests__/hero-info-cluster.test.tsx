// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import type { HeroDefinition } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HeroInfoCluster', () => {
  it('renders the image, tag, and ability styles for a hero', () => {
    const hero = {
      slug: 'greytalon',
      assetSlug: 'grey_talon',
      displayName: 'Grey Talon',
      portrait: '/panorama/images/heroes/greytalon.png',
      render: '/render/Grey_Talon_Render.png',
      heroInfo: {
        nameType: 'image',
        nameValue: '/panorama/images/heroes/hero_names/grey_talon.svg',
        nameColor: '#f1e7d2',
        tag1Text: 'Pressure',
        tag2Text: 'Frontline',
        tag3Text: 'Burst',
        tagColor: '#473424',
        tagTextColor: '#fff4df',
        tag1Tilt: -4.5,
        tag2Tilt: 1.2,
        tag3Tilt: 6.8,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/grey_talon/1.png',
        ability2Icon: '/panorama/images/hud/abilities/grey_talon/2.png',
        ability3Icon: '/panorama/images/hud/abilities/grey_talon/3.png',
        ability4Icon: '/panorama/images/hud/abilities/grey_talon/4.png',
        abilityCircleColor: '#f0ad5f',
        abilityIconColor: '#ffe5b8',
      },
    } satisfies HeroDefinition

    render(<HeroInfoCluster hero={hero} />)

    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'greytalon')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/hero_names/grey_talon.svg'))
    expect(screen.getByTestId('hero-info-tag-1')).toHaveAttribute('style', expect.stringContaining('background-color: rgb(71, 52, 36)'))
    expect(screen.getByTestId('hero-info-tag-1')).toHaveAttribute('style', expect.stringContaining('color: rgb(255, 244, 223)'))
    const tag1 = screen.getByTestId('hero-info-tag-1')
    const tag2 = screen.getByTestId('hero-info-tag-2')
    const tag3 = screen.getByTestId('hero-info-tag-3')

    expect(tag1).not.toHaveStyle({ transform: tag2.style.transform })
    expect(tag1).not.toHaveStyle({ transform: tag3.style.transform })
    expect(tag2).not.toHaveStyle({ transform: tag3.style.transform })
    expect(tag1.style.transform).toMatch(/^translateY\(-?\d+px\) rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(tag2.style.transform).toMatch(/^translateY\(-?\d+px\) rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(tag3.style.transform).toMatch(/^translateY\(-?\d+px\) rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(screen.getByTestId('hero-info-ability-1')).toHaveAttribute('style', expect.stringContaining('background-color: rgb(240, 173, 95)'))
    expect(screen.getByTestId('hero-info-ability-1').querySelector('[aria-hidden="true"]')).toHaveStyle({ backgroundColor: '#ffe5b8' })
    expect(screen.getByRole('button', { name: 'View Grey Talon character backstory' })).toBeInTheDocument()
  })

  it('supports the text name mode', () => {
    const hero = {
      slug: 'custom',
      assetSlug: 'custom',
      displayName: 'Custom Hero',
      portrait: '/panorama/images/heroes/abrams.png',
      render: '/render/Abrams_Render.png',
      heroInfo: {
        nameType: 'text',
        nameValue: 'Custom Name',
        nameColor: '#99ffdd',
        tag1Text: 'Alpha',
        tag2Text: 'Beta',
        tag3Text: 'Gamma',
        tagColor: 'rgba(0, 0, 0, 0.5)',
        tagTextColor: '#ffffff',
        tag1Tilt: 0,
        tag2Tilt: 0,
        tag3Tilt: 0,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/abrams/1.png',
        ability2Icon: '/panorama/images/hud/abilities/abrams/2.png',
        ability3Icon: '/panorama/images/hud/abilities/abrams/3.png',
        ability4Icon: '/panorama/images/hud/abilities/abrams/4.png',
        abilityCircleColor: '#ffffff',
        abilityIconColor: '#000000',
      },
    } satisfies HeroDefinition

    render(<HeroInfoCluster hero={hero} />)

    expect(screen.getByTestId('hero-info-name-text')).toHaveTextContent('Custom Name')
    expect(screen.getByTestId('hero-info-name-text')).toHaveStyle({ color: '#99ffdd' })
  })

  it('switches between integrated sidebar stat panels', async () => {
    const user = userEvent.setup()
    const hero = {
      slug: 'greytalon',
      assetSlug: 'grey_talon',
      displayName: 'Grey Talon',
      portrait: '/panorama/images/heroes/greytalon.png',
      render: '/render/Grey_Talon_Render.png',
      heroInfo: {
        nameType: 'image',
        nameValue: '/panorama/images/heroes/hero_names/grey_talon.svg',
        nameColor: '#f1e7d2',
        tag1Text: 'Pressure',
        tag2Text: 'Frontline',
        tag3Text: 'Burst',
        tagColor: '#473424',
        tagTextColor: '#fff4df',
        tag1Tilt: -4.5,
        tag2Tilt: 1.2,
        tag3Tilt: 6.8,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/grey_talon/1.png',
        ability2Icon: '/panorama/images/hud/abilities/grey_talon/2.png',
        ability3Icon: '/panorama/images/hud/abilities/grey_talon/3.png',
        ability4Icon: '/panorama/images/hud/abilities/grey_talon/4.png',
        abilityCircleColor: '#f0ad5f',
        abilityIconColor: '#ffe5b8',
      },
    } satisfies HeroDefinition

    render(<HeroInfoCluster hero={hero} />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    expect(screen.getByTestId('weapon-panel')).toHaveTextContent('Grey Talon Weapon')

    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))
    expect(screen.getByTestId('hero-stats-vitality-panel')).toBeVisible()
    expect(screen.getByRole('button', { name: /Max Health:/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Spirit stats' }))
    expect(screen.getByTestId('hero-stats-spirit-panel')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Spirit Power Impact' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByTestId('hero-info-name-image')).toBeInTheDocument()
  })

  it('replaces fallback panel data with fetched hero stats', async () => {
    const user = userEvent.setup()
    const hero = {
      slug: 'greytalon',
      assetSlug: 'grey_talon',
      displayName: 'Grey Talon',
      portrait: '/panorama/images/heroes/greytalon.png',
      render: '/render/Grey_Talon_Render.png',
      heroInfo: {
        nameType: 'image',
        nameValue: '/panorama/images/heroes/hero_names/grey_talon.svg',
        nameColor: '#f1e7d2',
        tag1Text: 'Pressure',
        tag2Text: 'Frontline',
        tag3Text: 'Burst',
        tagColor: '#473424',
        tagTextColor: '#fff4df',
        tag1Tilt: -4.5,
        tag2Tilt: 1.2,
        tag3Tilt: 6.8,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/grey_talon/1.png',
        ability2Icon: '/panorama/images/hud/abilities/grey_talon/2.png',
        ability3Icon: '/panorama/images/hud/abilities/grey_talon/3.png',
        ability4Icon: '/panorama/images/hud/abilities/grey_talon/4.png',
        abilityCircleColor: '#f0ad5f',
        abilityIconColor: '#ffe5b8',
      },
    } satisfies HeroDefinition
    const fetchedStats = buildHeroStatsSeed(hero)

    fetchedStats.vitality.stats[0] = {
      ...fetchedStats.vitality.stats[0],
      value: '999',
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fetchedStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<HeroInfoCluster hero={hero} />)

    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))

    expect(await screen.findByRole('button', { name: /Max Health: 999/ })).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/heroes/greytalon/stats', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('opens comments for a persisted community hero', async () => {
    const user = userEvent.setup()
    const hero = {
      id: '507f1f77bcf86cd799439011',
      slug: 'arc-light',
      assetSlug: 'arc-light',
      displayName: 'Arc Light',
      portrait: '/panorama/images/heroes/abrams.png',
      render: '/render/Abrams_Render.png',
      bookmarkedByCurrentUser: false,
      heroInfo: {
        nameType: 'text',
        nameValue: 'Arc Light',
        nameColor: '#99ffdd',
        tag1Text: 'Alpha',
        tag2Text: 'Beta',
        tag3Text: 'Gamma',
        tagColor: 'rgba(0, 0, 0, 0.5)',
        tagTextColor: '#ffffff',
        tag1Tilt: 0,
        tag2Tilt: 0,
        tag3Tilt: 0,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/abrams/1.png',
        ability2Icon: '/panorama/images/hud/abilities/abrams/2.png',
        ability3Icon: '/panorama/images/hud/abilities/abrams/3.png',
        ability4Icon: '/panorama/images/hud/abilities/abrams/4.png',
        abilityCircleColor: '#ffffff',
        abilityIconColor: '#000000',
      },
    } satisfies HeroDefinition & { id: string; bookmarkedByCurrentUser: boolean }
    const stats = buildHeroStatsSeed(hero)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/stats')) {
        return Promise.resolve(new Response(JSON.stringify(stats), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      if (url.includes('/bookmark')) {
        return Promise.resolve(new Response(JSON.stringify({ bookmark: { bookmarked: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      if (url.includes('/comments') && !url.includes('commentId')) {
        return Promise.resolve(new Response(JSON.stringify({
          comments: [
            {
              id: 'comment_1',
              authorName: 'caseworker',
              content: 'Strong silhouette.',
              viewerCanDelete: false,
              createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return Promise.resolve(new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    render(<HeroInfoCluster hero={hero} />)

    await user.click(screen.getByRole('button', { name: 'Bookmark' }))
    expect(await screen.findByRole('button', { name: 'Bookmarked' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Comments/ }))

    expect(await screen.findByText('Strong silhouette.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/507f1f77bcf86cd799439011/comments', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})

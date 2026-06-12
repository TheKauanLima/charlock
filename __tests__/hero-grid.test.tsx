// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HeroGrid from '@/components/HeroGrid/HeroGrid'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.priority

    return React.createElement('img', imageProps)
  },
}))

interface MockUploadButtonProps {
  endpoint: string
  content?: {
    button?: (state: {
      ready: boolean
      isUploading: boolean
      uploadProgress: number
      fileTypes: string[]
      files: File[]
    }) => React.ReactNode
  }
  onUploadBegin?: (fileName: string) => void
  onClientUploadComplete?: (files: Array<{ url: string; serverData: { url: string } }>) => void
}

vi.mock('@/lib/uploadthing', () => ({
  UploadButton: ({ endpoint, content, onUploadBegin, onClientUploadComplete }: MockUploadButtonProps) => {
    const uploadedUrl = `https://utfs.io/f/${endpoint}.png`
    const buttonLabel = content?.button?.({
      ready: true,
      isUploading: false,
      uploadProgress: 0,
      fileTypes: ['image'],
      files: [],
    }) ?? 'Upload'

    return React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `uploadthing-${endpoint}`,
        onClick: () => {
          onUploadBegin?.(`${endpoint}.png`)
          onClientUploadComplete?.([{ url: uploadedUrl, serverData: { url: uploadedUrl } }])
        },
      },
      buttonLabel,
    )
  },
  UploadDropzone: () => null,
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('HeroGrid', () => {
  it('renders 38 heroes and 2 empty slots', () => {
    render(<HeroGrid />)

    expect(screen.getAllByTestId('hero-card')).toHaveLength(38)
    expect(screen.getAllByTestId('hero-empty-slot')).toHaveLength(2)
  })

  it('can render the create tab as the initial state', () => {
    render(<HeroGrid initialTab="Create" />)

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-card')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute('aria-current', 'page')
  })

  it('loads the activity feed tab', async () => {
    const user = userEvent.setup()
    const stats = buildHeroStatsSeed(HEROES[0])
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/feed') {
        return Promise.resolve(new Response(JSON.stringify({
          items: [
            {
              id: 'comment:1',
              type: 'comment',
              createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
              heroId: 'hero_1',
              heroName: 'Arc Light',
              heroPortrait: HEROES[0].portrait,
              actorName: 'caseworker',
              content: 'Great lore hook.',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return Promise.resolve(new Response(JSON.stringify(stats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Feed' }))

    expect(await screen.findByRole('heading', { name: 'Arc Light' })).toBeInTheDocument()
    expect(screen.getByText('Great lore hook.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/feed', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('updates the active render when a hero is clicked', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    expect(screen.getByRole('img', { name: 'Abrams render' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'abrams')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/hero_names/abrams.svg'))

    await user.click(screen.getByRole('button', { name: 'Select character Grey Talon' }))

    expect(await screen.findByRole('img', { name: 'Grey Talon render' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'greytalon')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/hero_names/grey_talon.svg'))
  })

  it('updates the integrated stat panel when the active hero changes', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    expect(screen.getByTestId('weapon-panel')).toHaveTextContent('Abrams Weapon')

    await user.click(screen.getByRole('button', { name: 'Select character Grey Talon' }))

    expect(await screen.findByText('Grey Talon Weapon')).toBeInTheDocument()
    expect(screen.getByTestId('weapon-panel')).not.toHaveTextContent('Abrams Weapon')
  })

  it('opens the create editor and updates the render background', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-card')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Selected editor background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Abrams character backstory' })).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('editor-background-select'), '/panorama/images/heroes/backgrounds/yamato_bg_psd.png')

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('uses the top create sidebar tab to replace the background with an existing hero render', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByRole('tab', { name: 'Hero render' })).toBeInTheDocument()
    expect(screen.getByTestId('editor-name-image')).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('editor-background-select'), '/panorama/images/heroes/backgrounds/yamato_bg_psd.png')
    await user.click(screen.getByRole('button', { name: 'Asset' }))

    expect(screen.getByTestId('hero-render-modal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/render/Grey_Talon_Render.png'))
    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('edits hero identity fields in create mode in real time', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'text' }))

    await user.clear(screen.getByLabelText('Name Text'))
    await user.type(screen.getByLabelText('Name Text'), 'Arc Light')
    expect(screen.getByTestId('editor-name-text')).toHaveTextContent('Arc Light')

    await user.clear(screen.getByLabelText('Tag 1'))
    await user.type(screen.getByLabelText('Tag 1'), 'Skyline Breaker')
    expect(screen.getByTestId('editor-tag-1')).toHaveTextContent('Skyline Breaker')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('w-fit')
    expect(screen.getByTestId('editor-tags-row')).toHaveClass('flex-nowrap')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('shrink-0')
    expect(screen.getByTestId('editor-tag-1').querySelector('span')).toHaveClass('whitespace-nowrap')

    await user.clear(screen.getByLabelText('Tag 1 tilt'))
    await user.type(screen.getByLabelText('Tag 1 tilt'), '12')
    fireEvent.change(screen.getByLabelText('Tag 1 vertical position'), { target: { value: '-6' } })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(12deg) translateY(-6px)' })

    fireEvent.wheel(screen.getByTestId('editor-tag-1'), { deltaY: 100 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(12.5deg) translateY(-6px)' })

    fireEvent.pointerDown(screen.getByTestId('editor-tag-1'), { button: 0, clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('editor-tag-1'), { clientX: 30, pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('editor-tag-1'), { pointerId: 1 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(17.5deg) translateY(-6px)' })

    await user.clear(screen.getByLabelText('Hero Name hex value'))
    await user.type(screen.getByLabelText('Hero Name hex value'), '#123456')
    expect(screen.getByTestId('editor-name-text')).toHaveStyle({ color: '#123456' })

    const backstoryInput = screen.getByLabelText('Backstory')

    expect(backstoryInput).toHaveAttribute('wrap', 'soft')
    expect(backstoryInput).toHaveClass('overflow-y-auto')
    expect(backstoryInput).toHaveClass('overflow-x-hidden')

    await user.type(backstoryInput, 'Raised under neon rooftops, Arc Light learned to bottle thunder.')
    await user.click(screen.getByRole('button', { name: 'View Abrams character backstory' }))
    expect(within(screen.getByRole('dialog', { name: 'BACKSTORY:' })).getByText('Raised under neon rooftops, Arc Light learned to bottle thunder.')).toBeInTheDocument()
  })

  it('opens the focused ability editor from a create-mode ability circle', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))

    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-editor')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Seismic Ring')
    await user.click(screen.getByRole('button', { name: 'Choose ability icon' }))

    const modal = screen.getByTestId('property-icon-modal')

    await user.type(within(modal).getByPlaceholderText('Search property icons'), 'spirit')
    await user.click(within(modal).getByRole('button', { name: 'Use Spirit' }))
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const abilityMask = screen.getByTestId('editor-ability-1').querySelector('[aria-hidden="true"]')

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(abilityMask).toHaveAttribute('style', expect.stringContaining('/panorama/images/icons/properties/spirit.svg'))
    expect(screen.queryByTestId('property-icon-modal')).not.toBeInTheDocument()
  })

  it('stores Uploadthing asset URLs in the create draft', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'image' }))
    await user.click(screen.getByTestId('uploadthing-heroNameAsset'))

    expect(screen.getByTestId('editor-name-image')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroNameAsset.png'))

    await user.click(screen.getByTestId('uploadthing-heroRender'))

    await waitFor(() => expect(screen.getByTestId('editor-custom-render-layer')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroRender.png')))

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    await user.click(within(screen.getByTestId('weapon-mini-editor')).getByTestId('uploadthing-weaponImage'))

    expect(screen.getByRole('img', { name: 'Abrams Weapon weapon' })).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))
  })

  it('edits weapon panel stats with reactive modifier math', async () => {
    const user = userEvent.setup()
    const abrams = HEROES.find(hero => hero.slug === 'abrams')

    expect(abrams).toBeDefined()

    const seed = buildHeroStatsSeed(abrams!)
    const baseBulletDamage = Number(seed.weapon.stats.find(stat => stat.label === 'Bullet Damage')?.value ?? 0)
    const bulletsPerSecond = Number(seed.weapon.stats.find(stat => stat.label === 'Bullets per sec')?.value ?? 0)
    const expectedBulletDamage = (baseBulletDamage * 1.25).toFixed(1)
    const expectedDps = Math.floor(Number(expectedBulletDamage) * bulletsPerSecond)

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageInput = screen.getByLabelText('Weapon Damage value')

    await user.clear(weaponDamageInput)
    await user.type(weaponDamageInput, '25')

    expect(screen.getByLabelText('Bullet Damage value')).toHaveValue(expectedBulletDamage)
    expect(screen.getByText(String(expectedDps))).toBeInTheDocument()
    expect(screen.getByText('DPS')).toBeInTheDocument()
  })

  it('saves the full create draft from the global action bar', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const savedStats = buildHeroStatsSeed(abrams)
    const savedAbilityStats = buildDefaultAbilityStats(abrams)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/heroes') {
        return Promise.resolve(new Response(JSON.stringify({
          hero: {
            id: 'saved_hero_1',
            slug: 'arc-light',
            assetSlug: 'arc-light',
            displayName: 'Arc Light',
            portrait: abrams.portrait,
            render: '/panorama/images/heroes/backgrounds/abrams_bg_psd.png',
            background: '/panorama/images/heroes/backgrounds/abrams_bg_psd.png',
            heroInfo: {
              ...abrams.heroInfo,
              nameType: 'text',
              nameValue: 'Arc Light',
            },
            status: 'private',
            likesCount: 0,
            likedByCurrentUser: false,
            allowCopies: true,
            viewerCanEdit: true,
            publishedAt: null,
            createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            stats: savedStats,
            abilityStats: savedAbilityStats,
          },
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return Promise.resolve(new Response(JSON.stringify(savedStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'Save Private' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a hero name')
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/heroes')).toBe(false)

    await user.type(screen.getByPlaceholderText('Name this save'), 'Arc Light')
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Arc Pulse')
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByLabelText('Allow Copies'))
    await user.click(screen.getByRole('button', { name: 'Save Private' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { name: string; status: string; allowCopies: boolean; hero: { background: string }; heroInfo: { nameValue: string }; weapon: { stats: unknown[] }; abilityStats: { abilities: Array<{ name: string }> } }

    expect(requestBody).toMatchObject({
      name: 'Arc Light',
      status: 'private',
      allowCopies: true,
      hero: {
        background: expect.stringContaining('/panorama/images/heroes/backgrounds/abrams_bg_psd.png'),
      },
      heroInfo: {
        nameValue: abrams.heroInfo.nameValue,
      },
    })
    expect(requestBody.weapon.stats.length).toBeGreaterThan(0)
    expect(requestBody.abilityStats.abilities).toHaveLength(4)
    expect(requestBody.abilityStats.abilities[0].name).toBe('Arc Pulse')
    expect(await screen.findByRole('status')).toHaveTextContent('Private hero saved')
  })

  it('loads and likes published heroes in the Browse tab', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const publishedHero = {
      id: 'published_hero_1',
      slug: 'public-arc-light',
      assetSlug: 'public-arc-light',
      displayName: 'Public Arc Light',
      portrait: abrams.portrait,
      render: abrams.render,
      background: '/panorama/images/heroes/backgrounds/yamato_bg_psd.png',
      heroInfo: {
        ...abrams.heroInfo,
        nameType: 'text' as const,
        nameValue: 'Public Arc Light',
      },
      status: 'published',
      likesCount: 4,
      likedByCurrentUser: false,
      allowCopies: true,
      viewerCanEdit: false,
      publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
    }
    const stats = buildHeroStatsSeed({
      ...abrams,
      slug: publishedHero.slug,
      displayName: publishedHero.displayName,
      heroInfo: publishedHero.heroInfo,
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/like')) {
        return Promise.resolve(new Response(JSON.stringify({
          hero: {
            ...publishedHero,
            likesCount: 5,
            likedByCurrentUser: true,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      if (url.includes('/stats')) {
        return Promise.resolve(new Response(JSON.stringify(stats), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      if (url.includes('?id=')) {
        return Promise.resolve(new Response(JSON.stringify({
          hero: {
            ...publishedHero,
            stats,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return Promise.resolve(new Response(JSON.stringify({
        heroes: [publishedHero],
        pagination: { limit: 24, offset: 0, total: 1, hasMore: false },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Browse' }))

    expect(await screen.findByRole('button', { name: 'Select character Public Arc Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Most Liked' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByTestId('browse-card-background')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
    expect(screen.getByRole('button', { name: 'Use as Template' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Like Public Arc Light' })).toHaveTextContent('4')

    await user.click(screen.getByRole('button', { name: 'Like Public Arc Light' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlike Public Arc Light' })).toHaveTextContent('5'))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Arc')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=new&limit=24&offset=0&search=Arc', expect.objectContaining({ signal: expect.any(AbortSignal) })))
    await user.click(screen.getByRole('button', { name: 'Use as Template' }))
    expect(await screen.findByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name this save')).toHaveValue('')
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=new&limit=24&offset=0', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/published_hero_1/like', expect.objectContaining({ method: 'POST' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes/published_hero_1/copy', expect.objectContaining({ method: 'POST' })))
  })

  it('uses broad browse sorting and loads the next result page', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const pageOneHero = {
      id: 'filtered_hero_1',
      slug: 'filtered-arc-light',
      assetSlug: 'filtered-arc-light',
      displayName: 'Filtered Arc Light',
      portrait: abrams.portrait,
      render: abrams.render,
      background: abrams.render,
      heroInfo: abrams.heroInfo,
      status: 'published',
      likesCount: 7,
      likedByCurrentUser: false,
      allowCopies: false,
      viewerCanEdit: false,
      publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
    }
    const pageTwoHero = {
      ...pageOneHero,
      id: 'filtered_hero_2',
      slug: 'filtered-arc-light-2',
      assetSlug: 'filtered-arc-light-2',
      displayName: 'Filtered Arc Light 2',
    }
    const stats = buildHeroStatsSeed(abrams)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/stats')) {
        return Promise.resolve(new Response(JSON.stringify(stats), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      const parsedUrl = new URL(url, 'http://localhost')
      const offset = Number(parsedUrl.searchParams.get('offset') ?? 0)
      const hero = offset > 0 ? pageTwoHero : pageOneHero

      return Promise.resolve(new Response(JSON.stringify({
        heroes: [hero],
        pagination: { limit: 24, offset, total: 2, hasMore: offset === 0 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Browse' }))
    expect(await screen.findByRole('button', { name: 'Select character Filtered Arc Light' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DPS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'High Spirit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tanky' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trending' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=trending&limit=24&offset=0', expect.objectContaining({ signal: expect.any(AbortSignal) })))

    await user.click(screen.getByRole('button', { name: 'Load More' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select character Filtered Arc Light 2' })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=trending&limit=24&offset=1')
  })

  it('cycles scaling and edits weapon header assets in create mode', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageCell = screen.getByRole('button', { name: /Weapon Damage:/ })
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'none')

    await user.click(weaponDamageCell)
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'spirit')

    const weaponMiniEditor = screen.getByTestId('weapon-mini-editor')

    await user.clear(within(weaponMiniEditor).getByLabelText('Name'))
    await user.type(within(weaponMiniEditor).getByLabelText('Name'), 'Solar Repeater')
    expect(screen.getByText('Solar Repeater')).toBeInTheDocument()

    await user.clear(within(weaponMiniEditor).getByLabelText('Tags'))
    await user.type(within(weaponMiniEditor).getByLabelText('Tags'), 'Burst, Control')
    expect(screen.getByText('Burst')).toBeInTheDocument()
    expect(screen.getByText('Control')).toBeInTheDocument()

    await user.clear(within(weaponMiniEditor).getByLabelText('Description'))
    await user.type(within(weaponMiniEditor).getByLabelText('Description'), 'Overcharged precision rifle')
    expect(within(screen.getByTestId('weapon-panel')).getByText('Overcharged precision rifle')).toBeInTheDocument()

    await user.click(within(weaponMiniEditor).getByRole('button', { name: 'Asset' }))
    expect(screen.getByTestId('weapon-image-modal')).toBeInTheDocument()
    expect(screen.getByTestId('weapon-image-modal')).toHaveClass('pointer-events-auto')

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByRole('img', { name: 'Solar Repeater weapon' })).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/guns/Grey_Talon_Weapon.png'))
    expect(screen.queryByTestId('weapon-image-modal')).not.toBeInTheDocument()
  })
})

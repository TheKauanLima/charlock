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
  window.localStorage.clear()
})

beforeEach(() => {
  vi.restoreAllMocks()
})

async function openEmptyCreateEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('button', { name: 'Use EMPTY template' }))
}

describe('HeroGrid', () => {
  it('renders 38 heroes and 2 empty slots', () => {
    render(<HeroGrid />)

    expect(screen.getAllByTestId('hero-card')).toHaveLength(38)
    expect(screen.getAllByTestId('hero-empty-slot')).toHaveLength(2)
    expect(screen.getAllByTestId('hero-name-badge')[0]).toHaveTextContent('Abrams')
  })

  it('opens the create template picker with only Empty available', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByRole('dialog', { name: 'Choose Template' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ASSASSIN template not available' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use EMPTY template' })).toBeEnabled()
    expect(screen.getAllByText('Not available')).toHaveLength(6)
  })

  it('toggles editor panels and abilities into the Browse preview appearance', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))

    const vitalityPanel = screen.getByTestId('hero-stats-vitality-panel')
    const maxHealthCell = within(vitalityPanel).getByRole('group', { name: /Max Health/ })

    await user.click(within(maxHealthCell).getByRole('button', { name: 'Edit Max Health scaling' }))
    await user.click(screen.getByRole('button', { name: 'Set Max Health scaling to boon' }))
    await user.click(screen.getByRole('button', { name: 'Preview Mode' }))

    expect(screen.getByRole('button', { name: 'Edit Mode' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Edit Max Health scaling' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Max Health value')).not.toBeInTheDocument()
    expect(screen.getByLabelText('boon scaling value x0').className).toContain('valueWrapVisible')

    await user.click(screen.getByRole('button', { name: 'Preview Ability 1' }))

    expect(screen.getByTestId('ability-editor')).toHaveAccessibleName(/Ability preview/)
    expect(screen.getByLabelText('Ability Name')).toHaveAttribute('readonly')
    expect(screen.getByTestId('ability-mode-toggle')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('ability-mode-toggle')).toHaveAttribute('data-placement', 'right')
    expect(screen.getByTestId('ability-mode-toggle').parentElement).toHaveAttribute('data-ability-preview-panel', 'true')
    expect(screen.getByLabelText(/ability editor hero info/)).toBeInTheDocument()
    expect(screen.getByTestId('ability-mode-toggle').parentElement?.className).not.toContain('editorLayoutPreview')

    await user.click(screen.getByTestId('ability-mode-toggle'))

    expect(screen.getByTestId('ability-editor')).toHaveAccessibleName(/Ability editor/)
    expect(screen.getByLabelText('Ability Name')).not.toHaveAttribute('readonly')

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Preserved Preview Name')
    await user.click(screen.getByRole('button', { name: 'Preview Mode' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Preserved Preview Name')
    expect(screen.getByLabelText('Ability Name')).toHaveAttribute('readonly')

    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByRole('button', { name: 'Preview Ability 1' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Preserved Preview Name')
  })

  it('toggles scaling value details from the grid-side control', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const stats = buildHeroStatsSeed(abrams)

    stats.weapon.stats[0] = {
      ...stats.weapon.stats[0],
      scaling: 'spirit',
      scalingValue: '0.2',
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(stats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<HeroGrid />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    expect(await screen.findByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2').className).not.toContain('valueWrapVisible')

    await user.click(screen.getByRole('button', { name: 'Show Details' }))

    expect(screen.getByRole('button', { name: 'Hide Details' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('spirit scaling value x0.2').className).toContain('valueWrapVisible')
    expect(window.localStorage.getItem('charlock_show_details')).toBe('true')
  })

  it('can render the create tab as the initial state', () => {
    render(<HeroGrid initialTab="Create" />)

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-card')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute('aria-current', 'page')
  })

  it('loads the notifications tab from the profile menu route', async () => {
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

    render(<HeroGrid initialTab="Notifications" />)

    expect(await screen.findByRole('heading', { name: 'Arc Light' })).toBeInTheDocument()
    expect(screen.getByText('Great lore hook.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/feed', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('loads bookmarked heroes from the profile menu route', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const bookmarkedHero = {
      id: 'bookmarked_hero_1',
      slug: 'saved-arc-light',
      assetSlug: 'saved-arc-light',
      displayName: 'Saved Arc Light',
      portrait: abrams.portrait,
      render: abrams.render,
      background: '/panorama/images/heroes/backgrounds/yamato_bg_psd.png',
      heroInfo: {
        ...abrams.heroInfo,
        nameType: 'text' as const,
        nameValue: 'Saved Arc Light',
      },
      status: 'published',
      likesCount: 7,
      likedByCurrentUser: false,
      bookmarkedByCurrentUser: true,
      allowCopies: true,
      viewerCanEdit: false,
      publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
    }
    const abilityStats = buildDefaultAbilityStats({
      ...abrams,
      slug: bookmarkedHero.slug,
      displayName: bookmarkedHero.displayName,
      heroInfo: bookmarkedHero.heroInfo,
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      heroes: [{ ...bookmarkedHero, abilityStats }],
      pagination: { limit: 24, offset: 0, total: 1, hasMore: false },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    render(<HeroGrid initialTab="Bookmarks" />)

    expect(await screen.findByRole('button', { name: 'Select character Saved Arc Light' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bookmarks' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use as Template' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'saved-arc-light')

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Saved')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes?bookmarked=true&limit=24&offset=0&search=Saved', expect.objectContaining({ signal: expect.any(AbortSignal) })))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?bookmarked=true&limit=24&offset=0', expect.objectContaining({ signal: expect.any(AbortSignal) }))
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

  it('creates a new draft from the selected official hero button', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const stats = buildHeroStatsSeed(abrams)
    const abilityStats = buildDefaultAbilityStats(abrams)

    stats.weapon.weaponName = 'Copied Abrams Weapon'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ ...stats, abilityStats }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create hero from Abrams' }))

    expect(await screen.findByTestId('hero-info-editor')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    expect(screen.getByDisplayValue('Copied Abrams Weapon')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/abrams/stats')
  })

  it('opens the create editor and updates the render background', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-card')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Selected editor background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit NAME character backstory' })).toBeInTheDocument()

    await user.click(screen.getByTestId('editor-background-picker'))
    const backgroundModal = screen.getByTestId('background-modal')
    expect(within(backgroundModal).getAllByRole('button', { name: /^Use / })[0]).toHaveAccessibleName('Use Generic')
    expect(within(backgroundModal).getByRole('button', { name: 'Use Holliday' })).toBeInTheDocument()
    expect(within(backgroundModal).getByRole('button', { name: 'Use Mo & Krill' })).toBeInTheDocument()
    expect(within(backgroundModal).queryByRole('button', { name: 'Use Astro' })).not.toBeInTheDocument()

    await user.click(within(backgroundModal).getByRole('button', { name: 'Use Yamato' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('uses the top create sidebar tab to replace the background with an existing hero render', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    expect(screen.getByRole('tab', { name: 'Hero render' })).toBeInTheDocument()
    expect(screen.getByTestId('editor-name-text')).toHaveValue('NAME')

    await user.click(screen.getByTestId('editor-background-picker'))
    await user.click(within(screen.getByTestId('background-modal')).getByRole('button', { name: 'Use Yamato' }))
    await user.click(screen.getByRole('button', { name: 'Asset' }))

    expect(screen.getByTestId('hero-render-modal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/render/Grey_Talon_Render.png'))
    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('edits hero identity fields in create mode in real time', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'text' }))

    await user.clear(screen.getByLabelText('Hero name text'))
    await user.type(screen.getByLabelText('Hero name text'), 'Arc Light')
    expect(screen.getByTestId('editor-name-text')).toHaveValue('Arc Light')

    await user.clear(screen.getByLabelText('Tag 1 text'))
    await user.type(screen.getByLabelText('Tag 1 text'), 'Skyline Breaker')
    expect(screen.getByLabelText('Tag 1 text')).toHaveValue('Skyline Breaker')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('w-fit')
    expect(screen.getByTestId('editor-tags-row')).toHaveClass('flex-nowrap')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('shrink-0')
    expect(screen.getByLabelText('Tag 1 text')).toHaveClass('whitespace-nowrap')

    expect(screen.queryByText('Tag Position')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tag 1 tilt')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tag 1 vertical position')).not.toBeInTheDocument()

    fireEvent.wheel(screen.getByTestId('editor-tag-1'), { deltaY: 100 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(0.5deg) translateY(0px)' })

    const tagRotateHandle = screen.getByLabelText('Tag 1 rotate top right handle')
    fireEvent.pointerDown(tagRotateHandle, { button: 0, clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(tagRotateHandle, { clientX: 30, pointerId: 1 })
    fireEvent.pointerUp(tagRotateHandle, { pointerId: 1 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(5.5deg) translateY(0px)' })

    const tagMoveHandle = screen.getByLabelText('Tag 1 vertical top edge handle')
    fireEvent.pointerDown(tagMoveHandle, { button: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(tagMoveHandle, { clientY: -12, pointerId: 2 })
    fireEvent.pointerUp(tagMoveHandle, { pointerId: 2 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(5.5deg) translateY(-12px)' })

    await user.clear(screen.getByLabelText('Hero Name hex value'))
    expect(screen.getByLabelText('Hero Name hex value')).toHaveAttribute('placeholder', '#ffffff')
    const fontSelect = screen.getByLabelText('Font')
    expect(within(fontSelect).getByRole('option', { name: 'Valve Pulp' })).toBeInTheDocument()
    expect(within(fontSelect).getByRole('option', { name: 'Valve Occult' })).toBeInTheDocument()
    expect(within(fontSelect).getByRole('option', { name: 'Retail Demo' })).toBeInTheDocument()
    expect(within(fontSelect).getByRole('option', { name: 'Radiance' })).toBeInTheDocument()
    expect(within(fontSelect).getByRole('option', { name: 'Reaver' })).toBeInTheDocument()
    const fontSizeControl = screen.getByLabelText('Font Size')
    expect(fontSizeControl).toHaveAttribute('type', 'range')
    expect(fontSizeControl).toHaveAttribute('max', '30')
    expect(fontSizeControl).toHaveValue('6')
    fireEvent.change(fontSizeControl, { target: { value: '30' } })
    expect(screen.getByLabelText('Font size value')).toHaveValue(30)
    expect(screen.getByText('Size 30 of 30')).toBeInTheDocument()
    expect(screen.getByTestId('editor-name-text')).toHaveStyle({ fontSize: '10.2rem' })
    await user.type(screen.getByLabelText('Hero Name hex value'), '#123456')
    expect(screen.getByTestId('editor-name-text')).toHaveStyle({ color: '#123456' })

    await user.click(screen.getByRole('button', { name: 'Edit NAME character backstory' }))
    const backstoryDialog = screen.getByRole('dialog', { name: 'BACKSTORY:' })
    const backstoryInput = within(backstoryDialog).getByLabelText('Backstory')

    expect(backstoryInput).toHaveAttribute('wrap', 'soft')
    expect(backstoryInput.className).toContain('bodyInput')

    await user.type(backstoryInput, 'Raised under neon rooftops, Arc Light learned to bottle thunder.')
    expect(backstoryInput).toHaveValue('Raised under neon rooftops, Arc Light learned to bottle thunder.')
  })

  it('opens the focused ability editor from a create-mode ability circle', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
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

  it('opens the second ability slot modal from the focused ability editor toggle', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))

    expect(screen.getByRole('dialog', { name: 'SELECT SECONDARY ABILITIES' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle secondary Ability 1' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))

    expect(screen.getByRole('button', { name: 'Edit Secondary Ability 1' })).toBeInTheDocument()
  })

  it('publishes a second ability set enabled from the focused ability editor', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const savedStats = buildHeroStatsSeed(abrams)
    const savedAbilityStats = buildDefaultAbilityStats(abrams)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/heroes') {
        return Promise.resolve(new Response(JSON.stringify({
          hero: {
            id: 'published_secondary_hero',
            slug: 'published-secondary',
            assetSlug: 'published-secondary',
            displayName: 'Published Secondary',
            portrait: abrams.portrait,
            render: abrams.render,
            background: abrams.render,
            heroInfo: {
              ...abrams.heroInfo,
              nameType: 'text',
              nameValue: 'Published Secondary',
            },
            status: 'published',
            likesCount: 0,
            likedByCurrentUser: false,
            allowCopies: true,
            viewerCanEdit: true,
            publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
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

    await openEmptyCreateEditor(user)
    await user.type(screen.getByPlaceholderText('Name this save'), 'Published Secondary')
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))
    expect(screen.getByRole('button', { name: 'Edit Secondary Ability 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { status: string; abilityStats: { secondaryAbilities?: unknown[]; secondaryAbilitySlots?: number[]; secondaryAbilityAnchorIndex?: number } }

    expect(requestBody.status).toBe('published')
    expect(requestBody.abilityStats.secondaryAbilities).toHaveLength(1)
    expect(requestBody.abilityStats.secondaryAbilitySlots).toEqual([0])
    expect(requestBody.abilityStats.secondaryAbilityAnchorIndex).toBeUndefined()
  })

  it('does not publish secondary abilities when the selector closes without applying', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const savedStats = buildHeroStatsSeed(abrams)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/heroes') {
        return Promise.resolve(new Response(JSON.stringify({
          hero: {
            id: 'published_default_secondary',
            slug: 'published-default-secondary',
            assetSlug: 'published-default-secondary',
            displayName: 'Published Default Secondary',
            portrait: abrams.portrait,
            render: abrams.render,
            background: abrams.render,
            heroInfo: {
              ...abrams.heroInfo,
              nameType: 'text',
              nameValue: 'Published Default Secondary',
            },
            status: 'published',
            likesCount: 0,
            likedByCurrentUser: false,
            allowCopies: true,
            viewerCanEdit: true,
            publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
            stats: savedStats,
            abilityStats: buildDefaultAbilityStats(abrams),
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

    await openEmptyCreateEditor(user)
    await user.type(screen.getByPlaceholderText('Name this save'), 'Published Default Secondary')
    await user.click(screen.getByLabelText('Second Ability Set'))
    expect(screen.getByRole('dialog', { name: 'SELECT SECONDARY ABILITIES' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close second ability set modal' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { status: string; abilityStats: { secondaryAbilities?: unknown[]; secondaryAbilitySlots?: number[]; secondaryAbilityAnchorIndex?: number } }

    expect(requestBody.status).toBe('published')
    expect(requestBody.abilityStats.secondaryAbilities).toBeUndefined()
    expect(requestBody.abilityStats.secondaryAbilitySlots).toBeUndefined()
    expect(requestBody.abilityStats.secondaryAbilityAnchorIndex).toBeUndefined()
  })

  it('stores Uploadthing asset URLs in the create draft', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'image' }))
    await user.click(screen.getByTestId('uploadthing-heroNameAsset'))

    expect(screen.getByTestId('editor-name-image')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroNameAsset.png'))

    await user.click(screen.getByTestId('uploadthing-heroRender'))

    await waitFor(() => expect(screen.getByTestId('editor-custom-render-layer')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroRender.png')))

    await user.click(screen.getByTestId('uploadthing-heroPortrait'))
    expect(screen.getByTestId('editor-portrait-preview-image')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroPortrait.png'))

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    await user.click(within(screen.getByTestId('weapon-panel')).getByTestId('uploadthing-weaponImage'))

    expect(screen.getByRole('img', { name: 'WEAPON NAME weapon' })).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))
  })

  it('edits weapon panel stats with reactive modifier math', async () => {
    const user = userEvent.setup()
    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageInput = screen.getByLabelText('Weapon Damage value')

    await user.clear(weaponDamageInput)
    await user.type(weaponDamageInput, '25')

    expect(screen.getByLabelText('Bullet Damage value')).toHaveValue('0.0')
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

    await openEmptyCreateEditor(user)
    await user.click(screen.getByTestId('uploadthing-heroPortrait'))
    await user.clear(screen.getByPlaceholderText('Name this save'))
    await user.type(screen.getByPlaceholderText('Name this save'), 'Arc Light')
    await user.click(screen.getByLabelText('Second Ability Set'))
    expect(screen.getByRole('dialog', { name: 'SELECT SECONDARY ABILITIES' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Toggle secondary Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))
    expect(screen.getByRole('button', { name: 'Edit Secondary Ability 1' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Arc Pulse')
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByRole('button', { name: 'Edit Secondary Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Arc Echo')
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByLabelText('Allow Copies'))
    await user.click(screen.getByRole('button', { name: 'Save Private' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { name: string; status: string; allowCopies: boolean; hero: { background: string; portrait: string }; heroInfo: { nameValue: string; ability1Icon: string; ability2Icon: string; ability3Icon: string; ability4Icon: string }; weapon: { stats: unknown[] }; abilityStats: { abilities: Array<{ name: string }>; secondaryAbilities?: Array<{ name: string }>; secondaryAbilitySlots?: number[]; secondaryAbilityAnchorIndex?: number } }

    expect(requestBody).toMatchObject({
      name: 'Arc Light',
      status: 'private',
      allowCopies: true,
      hero: {
        background: expect.stringContaining('/panorama/images/heroes/backgrounds/generic_bg_psd.png'),
        portrait: 'https://utfs.io/f/heroPortrait.png',
      },
      heroInfo: {
        nameValue: 'NAME',
      },
    })
    expect(requestBody.weapon.stats.length).toBeGreaterThan(0)
    expect([
      requestBody.heroInfo.ability1Icon,
      requestBody.heroInfo.ability2Icon,
      requestBody.heroInfo.ability3Icon,
      requestBody.heroInfo.ability4Icon,
    ]).not.toContain('')
    expect(requestBody.abilityStats.abilities).toHaveLength(4)
    expect(requestBody.abilityStats.abilities[0].name).toBe('Arc Pulse')
    expect(requestBody.abilityStats.secondaryAbilities).toHaveLength(1)
    expect(requestBody.abilityStats.secondaryAbilitySlots).toEqual([0])
    expect(requestBody.abilityStats.secondaryAbilityAnchorIndex).toBeUndefined()
    expect(requestBody.abilityStats.secondaryAbilities?.[0]?.name).toBe('Arc Echo')
    expect(await screen.findByRole('status')).toHaveTextContent('Private hero saved')
    expect(screen.getByRole('button', { name: 'Edit Secondary Ability 1' })).toBeInTheDocument()
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
    const publishedAbilityStats = buildDefaultAbilityStats({
      ...abrams,
      slug: publishedHero.slug,
      displayName: publishedHero.displayName,
      heroInfo: publishedHero.heroInfo,
    })

    publishedAbilityStats.secondaryAbilities = publishedAbilityStats.abilities.slice(0, 3).map((ability, index) => ({
      ...ability,
      icon: `/published-secondary-${index + 1}.svg`,
    }))
    publishedAbilityStats.secondaryAbilitySlots = [0, 1, 2]
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
        return Promise.resolve(new Response(JSON.stringify({
          ...stats,
          abilityStats: publishedAbilityStats,
        }), {
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
        heroes: [{ ...publishedHero, abilityStats: publishedAbilityStats }],
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
    expect(screen.getByTestId('hero-name-badge')).toHaveTextContent('Public Arc Light')
    expect(await screen.findByTestId('hero-info-secondary-ability-1')).toBeInTheDocument()

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

  it('edits weapon scaling from the dropdown and edits weapon header assets in create mode', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageCell = screen.getByRole('group', { name: /Weapon Damage:/ })
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'none')

    await user.click(within(weaponDamageCell).getByRole('button', { name: 'Edit Weapon Damage scaling' }))
    await user.click(screen.getByRole('button', { name: 'Set Weapon Damage scaling to spirit' }))
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'spirit')

    const weaponPanel = screen.getByTestId('weapon-panel')

    await user.clear(within(weaponPanel).getByLabelText('Weapon name'))
    await user.type(within(weaponPanel).getByLabelText('Weapon name'), 'Solar Repeater')
    expect(within(weaponPanel).getByDisplayValue('Solar Repeater')).toBeInTheDocument()

    await user.clear(within(weaponPanel).getByLabelText('Weapon tags'))
    fireEvent.change(within(weaponPanel).getByLabelText('Weapon tags'), { target: { value: 'Burst, Control' } })
    expect(screen.getByText('Burst')).toBeInTheDocument()
    expect(within(weaponPanel).getByDisplayValue('Control')).toBeInTheDocument()

    await user.clear(within(weaponPanel).getByLabelText('Weapon description'))
    await user.type(within(weaponPanel).getByLabelText('Weapon description'), 'Overcharged precision rifle')
    expect(within(weaponPanel).getByDisplayValue('Overcharged precision rifle')).toBeInTheDocument()

    await user.click(within(weaponPanel).getByRole('button', { name: 'Assets' }))
    expect(screen.getByTestId('weapon-image-modal')).toBeInTheDocument()
    expect(screen.getByTestId('weapon-image-modal')).toHaveClass('pointer-events-auto')

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByRole('img', { name: 'Solar Repeater weapon' })).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/guns/Grey_Talon_Weapon.png'))
    expect(screen.queryByTestId('weapon-image-modal')).not.toBeInTheDocument()
  })
})

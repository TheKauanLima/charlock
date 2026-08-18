// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HeroGrid from '@/components/HeroGrid/HeroGrid'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import type { CustomHeroSummary } from '@/lib/custom-hero-types'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  user: null as { id: string } | null,
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => clerkState,
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.priority
    delete (imageProps as Record<string, unknown>).preload

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
  window.history.replaceState({}, '', '/')
})

beforeEach(() => {
  vi.restoreAllMocks()
  clerkState.isLoaded = true
  clerkState.isSignedIn = false
  clerkState.user = null
})

function buildCustomHero(id: string, displayName: string, overrides: Partial<CustomHeroSummary> = {}): CustomHeroSummary {
  const createdAt = overrides.createdAt ?? '2026-01-01T00:00:00.000Z'

  return {
    ...HEROES[0],
    id,
    slug: id,
    assetSlug: id,
    displayName,
    portrait: `https://example.com/${id}-portrait.png`,
    render: `https://example.com/${id}-render.png`,
    background: `https://example.com/${id}-background.png`,
    heroInfo: {
      ...HEROES[0].heroInfo,
      nameValue: displayName,
    },
    creatorId: 'user_1',
    status: 'private',
    likesCount: 0,
    likedByCurrentUser: false,
    bookmarkedByCurrentUser: false,
    allowCopies: true,
    viewerCanEdit: true,
    publishedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

async function openEmptyCreateEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('button', { name: 'Use EMPTY template' }))
}

async function confirmFocusedGoBack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByTestId('ability-editor')).getByRole('button', { name: 'Go Back' }))
}

async function confirmEditorExitSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Go Back' }))
  await user.click(await screen.findByRole('button', { name: 'Yes, Go Back' }))
}

describe('HeroGrid', () => {
  it('keeps the desktop grid at eight columns and custom hero actions out of layout flow', () => {
    const stylesheet = readFileSync('components/HeroGrid/HeroGrid.module.css', 'utf8')
    const gridRule = stylesheet.match(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/)?.[0]
    const gridViewportRule = stylesheet.match(/\.gridViewport\s*\{([^}]*)\}/)?.[1] ?? ''
    const mainRule = stylesheet.match(/\.main\s*\{([^}]*)\}/)?.[1] ?? ''
    const selectActionsRule = stylesheet.match(/\.selectHeroActions\s*\{[^}]*position:\s*absolute/)?.[0]
    const interactionModalRule = stylesheet.match(/\.interactionModalBackdrop\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(gridRule).toBeTruthy()
    expect(mainRule).toMatch(/min-height:\s*0/)
    expect(gridViewportRule).toMatch(/max-height:\s*100%/)
    expect(gridViewportRule).toMatch(/overflow-y:\s*auto/)
    expect(gridViewportRule).toMatch(/scrollbar-gutter:\s*stable/)
    expect(selectActionsRule).toBeTruthy()
    expect(interactionModalRule).toMatch(/position:\s*fixed/)
    expect(interactionModalRule).toMatch(/place-items:\s*center/)
    expect(interactionModalRule).toMatch(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.82\)/)
  })

  it('provides a keyboard-focusable scroll region around the main character grid', () => {
    render(<HeroGrid />)

    const gridViewport = screen.getByRole('region', { name: 'Select character grid' })

    expect(gridViewport).toHaveAttribute('tabindex', '0')
    expect(gridViewport).toContainElement(screen.getAllByTestId('hero-card')[0])
  })

  it('shows logged-out users only the 38 official heroes on Select', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    render(<HeroGrid />)

    expect(screen.getAllByTestId('hero-card')).toHaveLength(38)
    expect(screen.getAllByTestId('hero-empty-slot')).toHaveLength(2)
    expect(screen.getAllByTestId('hero-name-badge')[0]).toHaveTextContent('Abrams')
    expect(screen.getByRole('heading', { name: 'CURSED CONCEPTS' })).toBeInTheDocument()
    expect(screen.getByTestId('landing-title')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Abrams render' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-cluster')).not.toBeInTheDocument()
    expect(screen.queryByTestId('boon-rewards-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Details' })).not.toBeInTheDocument()
    expect(screen.getAllByTestId('hero-card').every(card => card.getAttribute('aria-pressed') === 'false')).toBe(true)

    const topBar = screen.getByRole('navigation', { name: 'Primary sections' })

    expect(topBar).toHaveAttribute('data-testid', 'primary-top-bar')
    expect(within(topBar).getByRole('button', { name: 'Select' })).toHaveAttribute('aria-current', 'page')
    expect(within(topBar).getByRole('button', { name: 'Browse' })).toBeInTheDocument()
    expect(within(topBar).getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(within(topBar).getAllByRole('button')).toHaveLength(3)
    expect(within(topBar).queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('merges owned custom heroes into Select in exact case-insensitive alphabetical order with deterministic ties', async () => {
    clerkState.isSignedIn = true
    clerkState.user = { id: 'user_1' }
    const newerAbrams = buildCustomHero('custom-abrams-new', 'abrams', {
      createdAt: '2026-03-01T00:00:00.000Z',
      portrait: 'https://example.com/newer-abrams.png',
    })
    const olderAbrams = buildCustomHero('custom-abrams-old', 'ABRAMS', {
      createdAt: '2025-03-01T00:00:00.000Z',
      portrait: 'https://example.com/older-abrams.png',
    })
    const customHeroes = [
      buildCustomHero('zeta', 'zeta'),
      newerAbrams,
      buildCustomHero('aardvark', 'aardvark'),
      olderAbrams,
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ heroes: customHeroes }))

    render(<HeroGrid />)

    await waitFor(() => expect(screen.getAllByTestId('hero-card')).toHaveLength(42))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?mine=true', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.queryAllByTestId('hero-empty-slot')).toHaveLength(0)

    const displayedNames = screen.getAllByTestId('hero-name-badge').map(badge => badge.textContent)
    const expectedNames = [...HEROES.map(hero => hero.displayName), 'zeta', 'ABRAMS', 'aardvark', 'abrams']
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    const doormanIndex = expectedNames.indexOf('The Doorman')

    expectedNames.splice(doormanIndex, 1)
    expectedNames.splice(expectedNames.indexOf('Drifter') + 1, 0, 'The Doorman')

    expect(displayedNames).toEqual(expectedNames)
    expect(displayedNames.indexOf('The Doorman')).toBe(displayedNames.indexOf('Drifter') + 1)
    expect(HEROES.findIndex(hero => hero.slug === 'doorman')).toBe(HEROES.findIndex(hero => hero.slug === 'drifter') + 1)

    const abramsCards = screen.getAllByRole('button', { name: /Select character Abrams/i })

    expect(abramsCards).toHaveLength(3)
    expect(within(abramsCards[0]).getByRole('img')).toHaveAttribute('src', HEROES[0].portrait)
    expect(within(abramsCards[1]).getByRole('img')).toHaveAttribute('src', expect.stringContaining('older-abrams.png'))
    expect(within(abramsCards[2]).getByRole('img')).toHaveAttribute('src', expect.stringContaining('newer-abrams.png'))
  })

  it('selects an owned custom hero and updates its stage render and info cluster', async () => {
    const user = userEvent.setup()
    const customHero = buildCustomHero('stage-custom', 'Stage Custom')
    clerkState.isSignedIn = true
    clerkState.user = { id: 'user_1' }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)

      if (url === '/api/heroes?mine=true') {
        return Response.json({ heroes: [customHero] })
      }

      if (url === '/api/heroes/stage-custom/stats') {
        return Response.json({
          ...buildHeroStatsSeed(customHero),
          abilityStats: buildDefaultAbilityStats(customHero),
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    render(<HeroGrid />)

    await user.click(await screen.findByRole('button', { name: 'Select character Stage Custom' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAccessibleName('Stage Custom background')
    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('stage-custom-background.png'))
    expect(screen.getByTestId('editor-custom-render-layer')).toHaveAccessibleName('Stage Custom render')
    expect(screen.getByTestId('editor-custom-render-layer')).toHaveAttribute('style', expect.stringContaining('stage-custom-render.png'))
    expect(screen.getByTestId('hero-info-cluster')).toHaveTextContent('Stage Custom')
    expect(screen.getByRole('button', { name: 'Edit Hero' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Stats' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Copy' })).toBeInTheDocument()
    expect(screen.getByTestId('select-hero-actions').className).toContain('selectHeroActions')
  })

  it('retracts the create settings rail and shifts the hero info preview left', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    const rail = screen.getByTestId('editor-control-rail')
    const previewStage = screen.getByTestId('editor-preview-stage')

    expect(rail).not.toHaveAttribute('data-collapsed')
    expect(previewStage.className).not.toContain('previewStageRailCollapsed')

    await user.click(screen.getByRole('button', { name: 'Retract editor settings panel' }))

    expect(rail).toHaveAttribute('data-collapsed', 'true')
    expect(previewStage.className).toContain('previewStageRailCollapsed')

    await user.click(screen.getByRole('button', { name: 'Expand editor settings panel' }))

    expect(rail).not.toHaveAttribute('data-collapsed')
    expect(previewStage.className).not.toContain('previewStageRailCollapsed')
  })

  it('keeps guarded draft navigation on the hero editor rail and opens abilities from the left editor rail', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      hero: {
        id: 'rail-saved-hero',
        slug: 'rail-saved-hero',
        assetSlug: 'rail-saved-hero',
        displayName: 'NAME',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        heroInfo: abrams.heroInfo,
        status: 'private',
        likesCount: 0,
        likedByCurrentUser: false,
        allowCopies: false,
        viewerCanEdit: true,
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: buildHeroStatsSeed(abrams),
        abilityStats: buildDefaultAbilityStats(abrams),
      },
    }))

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    const editorNav = screen.getByRole('navigation', { name: 'Hero editor navigation' })
    const orderedRailControls = [
      within(editorNav).getByRole('button', { name: 'Go Back' }),
      within(editorNav).getByRole('tab', { name: 'Text and font settings' }),
      within(editorNav).getByRole('tab', { name: 'Color settings' }),
      within(editorNav).getByRole('tab', { name: 'Image settings' }),
      within(editorNav).getByRole('button', { name: 'Open ability editor' }),
      within(editorNav).getByRole('tab', { name: 'Interactions' }),
      within(editorNav).getByRole('tab', { name: 'Editor options' }),
      within(editorNav).getByRole('link', { name: 'Open profile' }),
    ]

    expect(orderedRailControls.every((control, index) => (
      index === 0 || Boolean(orderedRailControls[index - 1].compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING)
    ))).toBe(true)
    expect(within(editorNav).getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByRole('tab', { name: 'Abilities' })).not.toBeInTheDocument()

    await user.click(within(editorNav).getByRole('button', { name: 'Open ability editor' }))

    expect(screen.getByTestId('ability-editor')).toHaveAccessibleName(/Ability editor/)
    expect(within(editorNav).getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByTestId('editor-preview-stage')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('editor-preview-stage').className).toContain('previewStageAbilityEditorActive')
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Rail Saved Ability')

    await user.click(within(editorNav).getByRole('tab', { name: 'Color settings' }))

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()
    expect(screen.getByTestId('editor-preview-stage')).not.toHaveAttribute('aria-hidden')
    expect(screen.getByTestId('editor-preview-stage').className).not.toContain('previewStageAbilityEditorActive')
    expect(within(editorNav).getByRole('tab', { name: 'Color settings' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Rail Saved Ability')

    await confirmFocusedGoBack(user)

    await user.click(within(screen.getByRole('navigation', { name: 'Hero editor navigation' })).getByRole('button', { name: 'Go Back' }))

    expect(screen.getByRole('dialog', { name: 'Go back to the main pages?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stay here' }))

    expect(screen.queryByRole('dialog', { name: 'Go back to the main pages?' })).not.toBeInTheDocument()
    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Hero editor navigation' })).getByRole('button', { name: 'Go Back' }))
    await user.click(screen.getByRole('button', { name: 'Yes, Go Back' }))

    expect(screen.queryByTestId('hero-info-editor')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CURSED CONCEPTS' })).toBeInTheDocument()
  })

  it('opens interactions from the left editor rail while keeping the editor pane and selected background', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    const editorNav = screen.getByRole('navigation', { name: 'Hero editor navigation' })
    const backgroundLayer = screen.getByRole('img', { name: 'Selected editor background' })
    const backgroundStyle = backgroundLayer.getAttribute('style')

    expect(within(screen.getByTestId('hero-sidebar-tabs')).queryByRole('tab', { name: 'Interactions' })).not.toBeInTheDocument()

    await user.click(within(editorNav).getByRole('tab', { name: 'Interactions' }))

    expect(screen.getByTestId('interaction-creator')).toBeInTheDocument()
    expect(screen.getByTestId('editor-control-rail')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'Interactions' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit NAME character backstory' })).toBeInTheDocument()
    expect(backgroundLayer).toHaveAttribute('style', backgroundStyle)

    await user.click(screen.getByRole('button', { name: 'Retract editor settings panel' }))

    expect(screen.getByTestId('editor-control-rail')).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByTestId('interaction-creator').className).toContain('creatorPaneCollapsed')
  })

  it('offers the signed-in user\'s custom heroes as interaction targets', async () => {
    const user = userEvent.setup()
    const ownedTarget = buildCustomHero('507f1f77bcf86cd799439011', 'Clockmaker')

    clerkState.isSignedIn = true
    clerkState.user = { id: 'user_1' }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)

      if (url === '/api/heroes?mine=true') {
        return Response.json({ heroes: [ownedTarget] })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    render(<HeroGrid />)

    await screen.findByRole('button', { name: 'Select character Clockmaker' })
    await openEmptyCreateEditor(user)
    await user.click(within(screen.getByRole('navigation', { name: 'Hero editor navigation' })).getByRole('tab', { name: 'Interactions' }))
    await user.click(screen.getByRole('button', { name: /new conversation/i }))

    const targetDialog = screen.getByRole('dialog', { name: /choose target hero/i })

    expect(within(targetDialog).getByRole('button', { name: 'Clockmaker (Your hero)' })).toBeInTheDocument()
  })

  it('removes the interaction creator before opening the incompatible ability editor', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    const editorNav = screen.getByRole('navigation', { name: 'Hero editor navigation' })
    const interactionsTab = within(editorNav).getByRole('tab', { name: 'Interactions' })

    await user.click(interactionsTab)

    expect(screen.getByTestId('interaction-creator')).toBeInTheDocument()
    expect(interactionsTab).toHaveAttribute('aria-selected', 'true')

    await user.click(within(editorNav).getByRole('button', { name: 'Open ability editor' }))

    expect(screen.queryByTestId('interaction-creator')).not.toBeInTheDocument()
    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    expect(interactionsTab).toHaveAttribute('aria-selected', 'false')
    expect(within(editorNav).getByRole('tab', { name: 'Text and font settings' })).toHaveAttribute('aria-selected', 'true')
    expect(document.getElementById('editor-interactions-panel')).toHaveAttribute('hidden')
    expect(document.getElementById('editor-interactions-panel')).not.toBeVisible()
  })

  it('closes and saves the focused ability editor when opening editor stat panels', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Stat Panel Saved Ability')
    await user.click(screen.getByRole('button', { name: 'Text' }))
    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    richTextEditor.textContent = 'Stat panel saved text'
    fireEvent.input(richTextEditor)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()
    expect(screen.getByTestId('weapon-panel')).toBeInTheDocument()
    expect(screen.getByTestId('editor-preview-stage')).not.toHaveAttribute('aria-hidden')

    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Stat Panel Saved Ability')
    expect(screen.getByRole('textbox', { name: 'Description rich text' })).toHaveTextContent('Stat panel saved text')
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
    expect(screen.getByRole('button', { name: 'Set Max Health scaling to boon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set Max Health scaling to other' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set Max Health scaling to spirit' }))
    await user.click(within(screen.getByTestId('editor-control-rail')).getByRole('button', { name: 'Preview Mode' }))
    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))

    expect(screen.getByRole('button', { name: 'Edit Mode' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Edit Max Health scaling' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Max Health value')).not.toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0').className).toContain('valueWrapVisible')

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
    await user.click(screen.getByTestId('ability-mode-toggle'))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Preserved Preview Name')
    expect(screen.getByLabelText('Ability Name')).toHaveAttribute('readonly')

    await confirmFocusedGoBack(user)
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

    await user.click(screen.getByRole('button', { name: 'Select character Abrams' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    expect(await screen.findByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2').className).not.toContain('valueWrapVisible')

    await user.click(screen.getByRole('button', { name: 'Show Details' }))

    expect(screen.getByRole('button', { name: 'Hide Details' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('spirit scaling value x0.2').className).toContain('valueWrapVisible')
    expect(window.localStorage.getItem('charlock_show_details')).toBe('true')
  })

  it('opens the template picker instead of Abrams when Create is the initial section', () => {
    render(<HeroGrid initialTab="Create" />)

    expect(screen.getByRole('dialog', { name: 'Choose Template' })).toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-cluster')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Abrams render' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens an existing profile hero for editing without showing the template picker', async () => {
    const abrams = HEROES[0]
    const savedHero = {
      id: 'profile_edit_hero',
      slug: 'profile-edit-hero',
      assetSlug: 'profile-edit-hero',
      displayName: 'Profile Edit Hero',
      portrait: abrams.portrait,
      render: abrams.render,
      background: abrams.render,
      heroInfo: {
        ...abrams.heroInfo,
        nameType: 'text' as const,
        nameValue: 'Profile Edit Hero',
        ability1Icon: '',
        ability2Icon: '',
        ability3Icon: '',
        ability4Icon: '',
      },
      status: 'private' as const,
      likesCount: 0,
      likedByCurrentUser: false,
      allowCopies: false,
      viewerCanEdit: true,
      publishedAt: null,
      createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      stats: buildHeroStatsSeed(abrams),
      abilityStats: buildDefaultAbilityStats(abrams),
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ hero: savedHero }))

    render(<HeroGrid initialTab="Create" initialHeroId="profile_edit_hero" />)

    expect(screen.queryByRole('dialog', { name: 'Choose Template' })).not.toBeInTheDocument()
    expect(await screen.findByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Choose Template' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name this draft')).toHaveValue('Profile Edit Hero')
    expect(screen.getByTestId('editor-ability-1').querySelector('[aria-hidden="true"]')?.getAttribute('style') ?? '').not.toContain('/panorama/images/hud/abilities/abrams/1.png')
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
      creatorId: 'creator_mongo_id',
      creator: {
        userId: 'user_creator_1',
        username: 'Rift Smith',
        profileSlug: 'rift_smith',
        avatarUrl: 'https://example.com/rift-smith-avatar.png',
        level: 'Power User' as const,
        preferredHero: 'haze',
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

    expect(screen.queryByRole('img', { name: 'Abrams render' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-cluster')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select character Abrams' }))

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

    await user.click(screen.getByRole('button', { name: 'Select character Abrams' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    expect(screen.getByTestId('weapon-panel')).toHaveTextContent('Abrams Weapon')

    await user.click(screen.getByRole('button', { name: 'Select character Grey Talon' }))

    await waitFor(() => expect(screen.getByTestId('weapon-panel')).toHaveAccessibleName('Grey Talon Weapon weapon stats'))
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

    await user.click(screen.getByRole('button', { name: 'Select character Abrams' }))
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
    await user.click(screen.getByRole('tab', { name: 'Image settings' }))

    await user.click(screen.getByTestId('editor-background-picker'))
    const backgroundModal = screen.getByTestId('background-modal')
    expect(within(backgroundModal).getAllByRole('button', { name: /^Use / })[0]).toHaveAccessibleName('Use Generic')
    expect(within(backgroundModal).getByRole('button', { name: 'Use Holliday' })).toBeInTheDocument()
    expect(within(backgroundModal).getByRole('button', { name: 'Use Mo & Krill' })).toBeInTheDocument()
    expect(within(backgroundModal).queryByRole('button', { name: 'Use Astro' })).not.toBeInTheDocument()

    await user.click(within(backgroundModal).getByRole('button', { name: 'Use Yamato' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('saves and closes the focused ability editor before opening the background picker', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Image settings' }))
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Background Saved Ability')
    await user.click(screen.getByRole('button', { name: 'Text' }))

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    richTextEditor.textContent = 'Saved before choosing a background'
    fireEvent.input(richTextEditor)

    await user.click(screen.getByTestId('editor-background-picker'))

    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()
    expect(screen.getByTestId('background-modal')).toBeInTheDocument()
    expect(screen.getByTestId('editor-preview-stage')).not.toHaveAttribute('aria-hidden')

    await user.click(within(screen.getByTestId('background-modal')).getByRole('button', { name: 'Use Yamato' }))
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Background Saved Ability')
    expect(screen.getByRole('textbox', { name: 'Description rich text' })).toHaveTextContent('Saved before choosing a background')
  })

  it('uses the top create sidebar tab to replace the background with an existing hero render', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    expect(screen.getByRole('tab', { name: 'Hero render' })).toBeInTheDocument()
    expect(screen.getByTestId('editor-name-text')).toHaveValue('NAME')

    await user.click(screen.getByRole('tab', { name: 'Image settings' }))
    await user.click(screen.getByTestId('editor-background-picker'))
    await user.click(within(screen.getByTestId('background-modal')).getByRole('button', { name: 'Use Yamato' }))
    await user.click(screen.getByRole('button', { name: 'Asset' }))

    expect(screen.getByTestId('hero-render-modal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/render/Grey_Talon_Render.png'))
    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
    expect(screen.queryByTestId('editor-custom-render-layer')).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('hero-render-layer'), { pointerId: 5, button: 0, clientX: 120, clientY: 140 })
    fireEvent.pointerMove(window, { pointerId: 5, clientX: 170, clientY: 190 })
    fireEvent.pointerUp(window, { pointerId: 5, clientX: 170, clientY: 190 })

    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('background-position'))
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
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'translateY(0px) rotate(0.5deg)' })

    const tagRotateHandle = screen.getByLabelText('Tag 1 rotate top right handle')
    fireEvent.pointerDown(tagRotateHandle, { button: 0, clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(tagRotateHandle, { clientX: 30, pointerId: 1 })
    fireEvent.pointerUp(tagRotateHandle, { pointerId: 1 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'translateY(0px) rotate(5.5deg)' })

    const tagMoveHandle = screen.getByLabelText('Tag 1 vertical top edge handle')
    fireEvent.pointerDown(tagMoveHandle, { button: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(tagMoveHandle, { clientY: -12, pointerId: 2 })
    fireEvent.pointerUp(tagMoveHandle, { pointerId: 2 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'translateY(-12px) rotate(5.5deg)' })

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

    await user.click(screen.getByRole('tab', { name: 'Color settings' }))
    await user.clear(screen.getByLabelText('Hero Name hex value'))
    expect(screen.getByLabelText('Hero Name hex value')).toHaveAttribute('placeholder', '#ffffff')
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
    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Hero editor navigation' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Seismic Ring')
    await user.click(screen.getByRole('button', { name: 'Choose ability icon' }))

    const modal = screen.getByTestId('property-icon-modal')

    await user.type(within(modal).getByPlaceholderText('Search property icons'), 'spirit')
    await user.click(within(modal).getByRole('button', { name: 'Use Spirit' }))
    await confirmFocusedGoBack(user)

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
    const abilityOneChoice = screen.getByRole('button', { name: 'Toggle secondary Ability 1' })
    const abilityTwoChoice = screen.getByRole('button', { name: 'Toggle secondary Ability 2' })

    expect(abilityOneChoice).toHaveAttribute('aria-pressed', 'true')
    expect(abilityOneChoice).toHaveAttribute('style', expect.stringContaining('background'))
    expect(abilityOneChoice.querySelector('[aria-hidden="true"]')).toHaveAttribute('style', expect.stringContaining('mask-image'))
    await user.click(abilityOneChoice)
    expect(abilityOneChoice).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Apply Selection' })).toBeEnabled()
    await user.click(abilityTwoChoice)
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))

    expect(screen.getByTestId('ability-editor-hero-info-secondary-ability-1')).toBeInTheDocument()
  })

  it('allows every secondary ability choice to be cleared through removal confirmation', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))
    expect(screen.getByTestId('ability-editor-hero-info-secondary-ability-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))
    await user.click(screen.getByRole('button', { name: 'Toggle secondary Ability 1' }))
    expect(screen.getByRole('button', { name: 'Toggle secondary Ability 1' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))

    expect(screen.getByRole('dialog', { name: 'REMOVE SECOND SET?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete Second Set' }))
    expect(screen.queryByRole('button', { name: 'Edit Secondary Ability 1' })).not.toBeInTheDocument()
  })

  it('keeps the existing ability primary until its explicit slot swap is used', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Existing Primary')
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Existing Primary')
    const primaryCircle = screen.getByTestId('ability-editor-hero-info-ability-1')
    const clippedIcon = primaryCircle.querySelector('[class*="abilityIconClipWithSecondary"]')

    expect(clippedIcon).toHaveAttribute('style', expect.stringContaining('radial-gradient'))
    expect(clippedIcon?.querySelector('[aria-hidden="true"]')).toHaveAttribute('style', expect.stringContaining('mask-image'))

    await user.click(screen.getByTestId('editor-secondary-ability-1'))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'New Secondary')
    await user.click(within(screen.getByTestId('ability-editor')).getByRole('button', { name: 'Swap primary and secondary Ability 1' }))

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Existing Primary')
    expect(screen.getByRole('button', { name: 'Change Secondary Ability 1 icon' })).toHaveAttribute('aria-pressed', 'true')

    await confirmFocusedGoBack(user)
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    expect(screen.getByLabelText('Ability Name')).toHaveValue('New Secondary')
    await confirmFocusedGoBack(user)
    await user.click(screen.getByTestId('editor-secondary-ability-1'))
    expect(screen.getByLabelText('Ability Name')).toHaveValue('Existing Primary')
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
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Published Secondary')
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))
    expect(screen.getByTestId('editor-secondary-ability-1')).toBeInTheDocument()
    await confirmFocusedGoBack(user)
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
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Published Default Secondary')
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
    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/generic_bg_psd.png'))

    await user.click(screen.getByTestId('uploadthing-heroPortrait'))
    expect(screen.getByTestId('editor-portrait-preview-image')).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/heroPortrait.png'))

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    await user.click(within(screen.getByTestId('weapon-panel')).getByTestId('uploadthing-weaponImage'))

    expect(screen.getByRole('img', { name: 'WEAPON NAME weapon' })).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))
  })

  it('drags uploaded hero renders and saves their render position', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      hero: {
        id: 'saved-hero',
        displayName: 'NAME',
        slug: 'saved-hero',
        assetSlug: 'saved-hero',
        portrait: '/portrait.png',
        render: 'https://utfs.io/f/heroRender.png',
        background: '/panorama/images/heroes/backgrounds/generic_bg_psd.png',
        heroInfo: HEROES[0].heroInfo,
        status: 'private',
        likesCount: 0,
        likedByCurrentUser: false,
        allowCopies: false,
        viewerCanEdit: true,
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: buildHeroStatsSeed(HEROES[0]),
        abilityStats: buildDefaultAbilityStats(HEROES[0]),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'image' }))
    await user.click(screen.getByTestId('uploadthing-heroRender'))

    const renderLayer = await screen.findByTestId('editor-custom-render-layer')

    expect(renderLayer).toHaveAccessibleName('Custom editor hero render')
    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/generic_bg_psd.png'))

    await waitFor(() => expect(screen.getByTestId('hero-grid-shell').className).toContain('renderDragEnabled'))

    fireEvent.pointerDown(screen.getByTestId('hero-grid-shell'), { pointerId: 9, button: 0, clientX: 120, clientY: 140 })
    fireEvent.pointerMove(window, { pointerId: 9, clientX: 162, clientY: 168 })
    fireEvent.pointerUp(window, { pointerId: 9, clientX: 162, clientY: 168 })

    await waitFor(() => expect(screen.getByTestId('editor-custom-render-layer')).toHaveAttribute('style', expect.stringContaining('background-position: calc(100% + 42px) calc(0% + 28px)')))
    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('background-position'))

    await user.clear(screen.getByPlaceholderText('Name this draft'))
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Positioned Render')
    await confirmEditorExitSave(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { hero: { render: string; renderPosition: { x: number; y: number } } }

    expect(requestBody.hero.render).toBe('https://utfs.io/f/heroRender.png')
    expect(requestBody.hero.renderPosition).toEqual({ x: 42, y: 28 })
  })

  it('shows draft save restrictions before leaving the editor', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.clear(screen.getByLabelText('Hero name text'))
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, Go Back' }))

    expect(await screen.findAllByRole('alert')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textContent: expect.stringContaining('Hero name is required') }),
      ]),
    )
    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' }))
  })

  it('explains missing ability icons when a draft cannot save', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      error: 'Ability 1 icon is required. Open Ability 1 and choose an ability icon.',
      code: 'INVALID_REQUEST',
      retryable: false,
    }, { status: 400 }))

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Iconless Draft')
    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, Go Back' }))

    expect(await screen.findAllByRole('alert')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textContent: expect.stringContaining('Ability 1 icon is required. Open Ability 1 and choose an ability icon.') }),
      ]),
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' }))
  })

  it('lets users customize and persist the draft autosave interval with a one-minute minimum', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)

    const intervalInput = screen.getByLabelText('Draft autosave interval value')
    const unitSelect = screen.getByLabelText('Draft autosave interval unit')

    expect(intervalInput).toHaveValue(1)
    expect(unitSelect).toHaveValue('minutes')
    expect(screen.queryByRole('option', { name: 'seconds' })).not.toBeInTheDocument()

    fireEvent.change(intervalInput, { target: { value: '0' } })
    expect(intervalInput).toHaveValue(1)
    expect(screen.getByText(/every 1 minute/i)).toBeInTheDocument()
    fireEvent.change(intervalInput, { target: { value: '61' } })

    expect(intervalInput).toHaveValue(60)
    expect(unitSelect).toHaveValue('minutes')
    expect(screen.getByText(/every 60 minutes/i)).toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('charlock_draft_autosave_interval') ?? '{}')).toEqual({
      amount: 60,
      unit: 'minutes',
    }))

    cleanup()
    render(<HeroGrid />)
    await openEmptyCreateEditor(user)

    expect(screen.getByLabelText('Draft autosave interval value')).toHaveValue(60)
    expect(screen.getByLabelText('Draft autosave interval unit')).toHaveValue('minutes')

    cleanup()
    window.localStorage.setItem('charlock_draft_autosave_interval', JSON.stringify({
      amount: 15,
      unit: 'seconds',
    }))
    render(<HeroGrid />)
    await openEmptyCreateEditor(user)

    expect(screen.getByLabelText('Draft autosave interval value')).toHaveValue(1)
    expect(screen.getByLabelText('Draft autosave interval unit')).toHaveValue('minutes')
  })

  it('disables uploaded render dragging while ability editor text is editable', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('button', { name: 'image' }))
    await user.click(screen.getByTestId('uploadthing-heroRender'))

    await screen.findByTestId('editor-custom-render-layer')
    await waitFor(() => expect(screen.getByTestId('hero-grid-shell').className).toContain('renderDragEnabled'))

    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))

    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('hero-grid-shell').className).not.toContain('renderDragEnabled'))

    fireEvent.pointerDown(screen.getByTestId('hero-grid-shell'), { pointerId: 12, button: 0, clientX: 140, clientY: 150 })
    fireEvent.pointerMove(window, { pointerId: 12, clientX: 175, clientY: 185 })
    fireEvent.pointerUp(window, { pointerId: 12, clientX: 175, clientY: 185 })

    expect(screen.getByTestId('editor-custom-render-layer')).not.toHaveAttribute('style', expect.stringContaining('background-position: calc(100% + 35px) calc(0% + 35px)'))

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Editable Ability Text')

    const tierOneText = screen.getByRole('textbox', { name: 'Tier 1 upgrade text' })

    tierOneText.textContent = 'Editable tier text'
    fireEvent.input(tierOneText)

    expect(screen.getByLabelText('Ability Name')).toHaveValue('Editable Ability Text')
    expect(tierOneText).toHaveTextContent('Editable tier text')
  })

  it('stores weapon image uploads on the active weapon panel variant', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    const baseWeaponName = (screen.getByLabelText('Weapon name') as HTMLInputElement).value

    await user.click(screen.getByRole('button', { name: 'Add Weapon panel' }))
    await user.type(screen.getByLabelText('New Weapon panel name'), 'Shotgun')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(within(screen.getByTestId('weapon-panel')).getByTestId('uploadthing-weaponImage'))

    expect(screen.getByRole('img', { name: 'Shotgun weapon' })).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))

    await user.click(screen.getByRole('tab', { name: baseWeaponName, exact: true }))
    expect(screen.getByRole('img', { name: `${baseWeaponName} weapon` })).not.toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))

    await user.click(screen.getByRole('tab', { name: 'Shotgun' }))
    expect(screen.getByRole('img', { name: 'Shotgun weapon' })).toHaveAttribute('style', expect.stringContaining('https://utfs.io/f/weaponImage.png'))
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

    await user.clear(screen.getByLabelText('Bullet Damage value'))
    await user.type(screen.getByLabelText('Bullet Damage value'), '10')
    await user.clear(screen.getByLabelText('Bullets per sec value'))
    await user.type(screen.getByLabelText('Bullets per sec value'), '2')

    const dpsValue = screen.getByText('DPS').parentElement

    expect(dpsValue).toHaveTextContent('20DPS')

    await user.click(screen.getByLabelText('Shotgun Pellets'))
    await user.clear(screen.getByLabelText('Pellet Count value'))
    await user.type(screen.getByLabelText('Pellet Count value'), '6')

    expect(dpsValue).toHaveTextContent('120DPS')

    await user.click(screen.getByLabelText('Shotgun Pellets'))
    expect(dpsValue).toHaveTextContent('20DPS')
  })

  it('adds and removes named Boon, Weapon, Vitality, and Spirit panels with independent values', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)
    await openEmptyCreateEditor(user)

    await user.click(screen.getByRole('button', { name: 'Rename active Boon panel' }))
    await user.clear(screen.getByLabelText('Rename Boon panel'))
    await user.type(screen.getByLabelText('Rename Boon panel'), 'Blessings')
    await user.click(screen.getByRole('button', { name: 'Save Name' }))
    expect(screen.getByRole('tab', { name: 'Blessings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Boon panel' }))
    await user.type(screen.getByLabelText('New Boon panel name'), 'Aggressive')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Rename active Boon panel' }))
    await user.clear(screen.getByLabelText('Rename Boon panel'))
    await user.type(screen.getByLabelText('Rename Boon panel'), 'Momentum')
    await user.click(screen.getByRole('button', { name: 'Save Name' }))
    expect(screen.getByRole('tab', { name: 'Momentum' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Base Bullet Damage value'))
    await user.type(screen.getByLabelText('Base Bullet Damage value'), '2.5')
    await user.click(screen.getByRole('tab', { name: 'Blessings' }))
    expect(screen.getByLabelText('Base Bullet Damage value')).toHaveValue('0.31')
    await user.click(screen.getByRole('tab', { name: 'Momentum' }))
    expect(screen.getByLabelText('Base Bullet Damage value')).toHaveValue('2.5')
    await user.click(screen.getByRole('button', { name: 'Remove active Boon panel' }))
    expect(screen.queryByRole('tab', { name: 'Momentum' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Blessings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Base Bullet Damage value')).toHaveValue('0.31')

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    const baseWeaponName = (screen.getByLabelText('Weapon name') as HTMLInputElement).value

    await user.click(screen.getByRole('button', { name: 'Add Weapon panel' }))
    await user.type(screen.getByLabelText('New Weapon panel name'), 'Shotgun')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByLabelText('Weapon name')).toHaveValue('Shotgun')
    await user.clear(screen.getByLabelText('Weapon name'))
    await user.type(screen.getByLabelText('Weapon name'), 'Scattergun')
    expect(screen.getByRole('tab', { name: 'Scattergun' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Weapon description'))
    await user.type(screen.getByLabelText('Weapon description'), 'Scattergun pressure burst.')
    await user.type(screen.getByLabelText('Weapon tags'), 'BREACH')
    await user.clear(screen.getByLabelText('Bullet Damage value'))
    await user.type(screen.getByLabelText('Bullet Damage value'), '12')
    await user.click(screen.getByRole('tab', { name: baseWeaponName, exact: true }))
    expect(screen.getByLabelText('Weapon name')).toHaveValue(baseWeaponName)
    expect(screen.getByLabelText('Weapon description')).not.toHaveValue('Scattergun pressure burst.')
    expect(screen.getByLabelText('Weapon tags')).not.toHaveValue('BREACH')
    expect(screen.getByLabelText('Bullet Damage value')).toHaveValue('0')
    await user.click(screen.getByRole('tab', { name: 'Scattergun' }))
    expect(screen.getByLabelText('Weapon description')).toHaveValue('Scattergun pressure burst.')
    expect(screen.getByLabelText('Weapon tags')).toHaveValue('BREACH')
    expect(screen.getByLabelText('Bullet Damage value')).toHaveValue('12')
    await user.click(screen.getByRole('button', { name: 'Remove active Weapon panel' }))
    expect(screen.queryByRole('tab', { name: 'Scattergun' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Weapon name')).toHaveValue(baseWeaponName)

    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))
    await user.click(screen.getByRole('button', { name: 'Rename active Vitality panel' }))
    await user.clear(screen.getByLabelText('Rename Vitality panel'))
    await user.type(screen.getByLabelText('Rename Vitality panel'), 'Fortitude')
    await user.click(screen.getByRole('button', { name: 'Save Name' }))
    expect(screen.getByRole('tab', { name: 'Fortitude' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Vitality panel' }))
    await user.type(screen.getByLabelText('New Vitality panel name'), 'Tank')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.clear(screen.getByLabelText('Max Health value'))
    await user.type(screen.getByLabelText('Max Health value'), '999')
    await user.click(screen.getByRole('tab', { name: 'Fortitude', exact: true }))
    expect(screen.getByLabelText('Max Health value')).toHaveValue('0')
    await user.click(screen.getByRole('tab', { name: 'Tank' }))
    expect(screen.getByLabelText('Max Health value')).toHaveValue('999')
    await user.click(screen.getByRole('button', { name: 'Remove active Vitality panel' }))
    expect(screen.queryByRole('tab', { name: 'Tank' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Max Health value')).toHaveValue('0')

    await user.click(screen.getByRole('tab', { name: 'Spirit stats' }))
    await user.click(screen.getByRole('button', { name: 'Add Spirit panel' }))
    await user.type(screen.getByLabelText('New Spirit panel name'), 'Caster')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.clear(screen.getByLabelText('Spirit Power value'))
    await user.type(screen.getByLabelText('Spirit Power value'), '80')
    await user.click(screen.getByRole('tab', { name: 'Spirit', exact: true }))
    expect(screen.getByLabelText('Spirit Power value')).toHaveValue('0')
    await user.click(screen.getByRole('tab', { name: 'Caster' }))
    expect(screen.getByLabelText('Spirit Power value')).toHaveValue('80')
    await user.click(screen.getByRole('button', { name: 'Rename active Spirit panel' }))
    await user.clear(screen.getByLabelText('Rename Spirit panel'))
    await user.type(screen.getByLabelText('Rename Spirit panel'), 'Mystic')
    await user.click(screen.getByRole('button', { name: 'Save Name' }))
    expect(screen.getByRole('tab', { name: 'Mystic' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove active Spirit panel' }))
    expect(screen.queryByRole('tab', { name: 'Mystic' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Spirit Power value')).toHaveValue('0')
  }, 10000)

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
    await user.clear(screen.getByLabelText('Boon stat 1 label'))
    await user.type(screen.getByLabelText('Boon stat 1 label'), 'Bullet Bonus')
    await user.click(screen.getByRole('button', { name: 'Change Bullet Bonus icon' }))
    await user.click(within(screen.getByTestId('boon-stat-icon-modal')).getByRole('button', { name: 'Use Spirit' }))
    await user.click(screen.getByRole('button', { name: 'Add Boon Stat' }))
    await user.clear(screen.getByLabelText('Boon stat 5 label'))
    await user.type(screen.getByLabelText('Boon stat 5 label'), 'Air Control')
    await user.clear(screen.getByLabelText('Air Control value'))
    await user.type(screen.getByLabelText('Air Control value'), '9')
    await user.click(screen.getByRole('button', { name: 'Change Air Control icon' }))
    await user.click(within(screen.getByTestId('boon-stat-icon-modal')).getByRole('button', { name: 'Use Heal' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    await user.click(screen.getByLabelText('Shotgun Pellets'))
    await user.click(screen.getByRole('button', { name: 'Change Bullet Damage type (Bullet)' }))
    await user.clear(screen.getByLabelText('Pellet Count value'))
    await user.type(screen.getByLabelText('Pellet Count value'), '7')
    await user.click(screen.getByTestId('uploadthing-heroPortrait'))
    await user.clear(screen.getByPlaceholderText('Name this draft'))
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Arc Light')
    await user.click(screen.getByLabelText('Second Ability Set'))
    expect(screen.getByRole('dialog', { name: 'SELECT SECONDARY ABILITIES' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Toggle secondary Ability 1' }))
    await user.click(screen.getByRole('button', { name: 'Apply Selection' }))
    expect(screen.getByTestId('editor-secondary-ability-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Arc Pulse')
    await confirmFocusedGoBack(user)
    await user.click(screen.getByTestId('editor-secondary-ability-1'))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Arc Echo')
    await confirmFocusedGoBack(user)
    await user.click(screen.getByLabelText('Allow Copies'))
    await confirmEditorExitSave(user)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/heroes')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as { name: string; status: string; allowCopies: boolean; hero: { background: string; portrait: string }; heroInfo: { nameValue: string; ability1Icon: string; ability2Icon: string; ability3Icon: string; ability4Icon: string }; boon: { stats: Array<{ label: string; value: string; icon?: string; scaling: string; scalingValue: string }> }; weapon: { stats: Array<{ label: string; value: string }> }; abilityStats: { abilities: Array<{ name: string }>; secondaryAbilities?: Array<{ name: string }>; secondaryAbilitySlots?: number[]; secondaryAbilityAnchorIndex?: number } }

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
    expect(requestBody.boon.stats).toHaveLength(5)
    expect(requestBody.boon.stats.every(stat => stat.scaling === 'boon' && stat.scalingValue === stat.value)).toBe(true)
    expect(requestBody.boon.stats[0]).toMatchObject({ label: 'Bullet Bonus', icon: '/panorama/images/icons/properties/spirit.svg' })
    expect(requestBody.boon.stats).toContainEqual(expect.objectContaining({ label: 'Air Control', value: '9', icon: '/panorama/images/icons/properties/heal.svg' }))
    expect(requestBody.weapon.stats).toContainEqual(expect.objectContaining({ label: 'Pellet Count', value: '7' }))
    expect(requestBody.weapon.stats).toContainEqual(expect.objectContaining({ label: 'Bullet Damage', icon: 'damage_magic_color' }))
    expect([
      requestBody.heroInfo.ability1Icon,
      requestBody.heroInfo.ability2Icon,
      requestBody.heroInfo.ability3Icon,
      requestBody.heroInfo.ability4Icon,
    ]).toEqual(['', '', '', ''])
    expect(requestBody.abilityStats.abilities).toHaveLength(4)
    expect(requestBody.abilityStats.abilities[0].name).toBe('Arc Pulse')
    expect(requestBody.abilityStats.secondaryAbilities).toHaveLength(1)
    expect(requestBody.abilityStats.secondaryAbilitySlots).toEqual([0])
    expect(requestBody.abilityStats.secondaryAbilityAnchorIndex).toBeUndefined()
    expect(requestBody.abilityStats.secondaryAbilities?.[0]?.name).toBe('Arc Echo')
  })

  it('manually saves the complete private draft immediately without waiting for autosave', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const savedStats = buildHeroStatsSeed(abrams)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/heroes' || init?.method !== 'POST') {
        return Promise.resolve(Response.json(savedStats))
      }

      const payload = JSON.parse(String(init.body))

      return Promise.resolve(Response.json({
        hero: {
          id: 'manually-saved-draft',
          slug: 'manually-saved-draft',
          assetSlug: 'manually-saved-draft',
          displayName: payload.name,
          portrait: payload.hero.portrait,
          render: payload.hero.render,
          background: payload.hero.background,
          heroInfo: payload.heroInfo,
          status: payload.status,
          likesCount: 0,
          likedByCurrentUser: false,
          allowCopies: payload.allowCopies,
          viewerCanEdit: true,
          publishedAt: null,
          createdAt: new Date('2026-08-06T12:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-08-06T12:00:00.000Z').toISOString(),
          stats: {
            heroInfo: payload.heroInfo,
            boon: payload.boon,
            weapon: payload.weapon,
            vitality: payload.vitality,
            spirit: payload.spirit,
          },
          abilityStats: payload.abilityStats,
          interactions: payload.interactions,
        },
      }, { status: 201 }))
    })

    render(<HeroGrid />)

    await openEmptyCreateEditor(user)
    await user.clear(screen.getByLabelText('Boon stat 1 label'))
    await user.type(screen.getByLabelText('Boon stat 1 label'), 'Manual Bonus')
    await user.type(screen.getByPlaceholderText('Name this draft'), 'Manual Arc')
    await user.click(screen.getByRole('button', { name: 'Edit Ability 1' }))
    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Unsynced Manual Ability')
    await user.click(screen.getByRole('button', { name: 'Save Draft Now' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const saveCall = fetchMock.mock.calls.find(([input, init]) => String(input) === '/api/heroes' && init?.method === 'POST')
    const requestBody = JSON.parse(String(saveCall?.[1]?.body)) as {
      name: string
      status: string
      boon: { stats: Array<{ label: string }> }
      abilityStats: { abilities: Array<{ name: string }> }
    }

    expect(requestBody).toMatchObject({
      name: 'Manual Arc',
      status: 'private',
    })
    expect(requestBody.boon.stats[0].label).toBe('Manual Bonus')
    expect(requestBody.abilityStats.abilities[0].name).toBe('Unsynced Manual Ability')
    expect(await screen.findByText('Draft saved to your profile.')).toBeInTheDocument()
  })

  it('lets an owner confirm unpublishing a hero and returns it to private saves', async () => {
    const user = userEvent.setup()
    const abrams = HEROES[0]
    const savedStats = buildHeroStatsSeed(abrams)
    const savedAbilityStats = buildDefaultAbilityStats(abrams)
    const publishedHero = {
      id: 'owner_published_hero',
      slug: 'owner-published-hero',
      assetSlug: 'owner-published-hero',
      displayName: 'Owner Published Hero',
      portrait: abrams.portrait,
      render: abrams.render,
      background: abrams.render,
      heroInfo: {
        ...abrams.heroInfo,
        nameType: 'text' as const,
        nameValue: 'Owner Published Hero',
      },
      status: 'published' as const,
      likesCount: 0,
      likedByCurrentUser: false,
      allowCopies: true,
      viewerCanEdit: true,
      publishedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      createdAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-06-05T12:00:00.000Z').toISOString(),
      stats: savedStats,
      abilityStats: savedAbilityStats,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/heroes?id=owner_published_hero') {
        return Promise.resolve(Response.json({ hero: publishedHero }))
      }

      if (url === '/api/heroes' && init?.method === 'POST') {
        return Promise.resolve(Response.json({
          hero: {
            ...publishedHero,
            status: 'private',
            publishedAt: null,
          },
        }, { status: 201 }))
      }

      return Promise.resolve(Response.json(savedStats))
    })

    window.history.replaceState({}, '', '/?heroId=owner_published_hero')
    render(<HeroGrid />)

    expect(await screen.findByRole('button', { name: 'Unpublish Hero' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Published Changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Private' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unpublish Hero' }))

    const confirmation = screen.getByRole('dialog', { name: 'Unpublish Hero?' })

    expect(within(confirmation).getByText(/removed from Browse/i)).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Confirm Unpublish' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', expect.objectContaining({ method: 'POST' })))

    const unpublishCall = fetchMock.mock.calls.find(([input, init]) => String(input) === '/api/heroes' && init?.method === 'POST')
    const requestBody = JSON.parse(String(unpublishCall?.[1]?.body)) as { id: string; status: string }

    expect(requestBody).toMatchObject({
      id: 'owner_published_hero',
      status: 'private',
    })
    expect(await screen.findByText('Hero unpublished and moved to your private saves.')).toBeInTheDocument()
    expect(screen.getByText('Draft autosaves privately')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unpublish Hero' })).not.toBeInTheDocument()
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
      creatorId: 'creator_mongo_id',
      creator: {
        userId: 'user_creator_1',
        username: 'Rift Smith',
        profileSlug: 'rift_smith',
        avatarUrl: 'https://example.com/rift-smith-avatar.png',
        level: 'Power User' as const,
        preferredHero: 'haze',
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
    const creatorLink = screen.getByRole('link', { name: 'View Rift Smith profile' })
    const browseCard = screen.getByRole('button', { name: 'Select character Public Arc Light' }).closest('article')
    const socialActions = screen.getByRole('region', { name: 'Public Arc Light social actions' })

    expect(creatorLink).toHaveAttribute('href', '/profile/rift_smith')
    expect(creatorLink).toHaveAttribute('title', 'View Rift Smith profile')
    expect(creatorLink.querySelector('img')).toHaveAttribute('src', 'https://example.com/rift-smith-avatar.png')
    expect(socialActions).toContainElement(creatorLink)
    expect(browseCard).not.toBeNull()
    expect(within(browseCard as HTMLElement).queryByRole('link', { name: 'View Rift Smith profile' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Like Public Arc Light' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlike Public Arc Light' })).toHaveTextContent('5'))
    expect(screen.getByRole('link', { name: 'View Rift Smith profile' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Arc')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=new&limit=24&offset=0&search=Arc', expect.objectContaining({ signal: expect.any(AbortSignal) })))
    await user.click(screen.getByRole('button', { name: 'Use as Template' }))
    expect(await screen.findByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name this draft')).toHaveValue('')
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=new&limit=24&offset=0', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/published_hero_1/like', expect.objectContaining({ method: 'POST' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes/published_hero_1/copy', expect.objectContaining({ method: 'POST' })))
  })

  it('loads and displays every published interaction from the Browse tab', async () => {
    const user = userEvent.setup()
    const publishedHero = buildCustomHero('interaction_hero_1', 'Dialogue Keeper', {
      status: 'published',
      viewerCanEdit: false,
      publishedAt: '2026-08-01T12:00:00.000Z',
    })
    const stats = buildHeroStatsSeed(publishedHero)
    const detailedHero = {
      ...publishedHero,
      stats,
      abilityStats: buildDefaultAbilityStats(publishedHero),
      interactions: [
        {
          id: 'interaction-haze',
          targetHeroId: 'haze',
          targetHeroName: 'Haze',
          title: 'A Quiet Warning',
          lines: [
            { id: 'line-3', speakerSide: 'right' as const, speakerHeroId: 'haze', text: 'You never saw me.', order: 0 },
          ],
          createdAt: '2026-08-02T12:00:00.000Z',
          updatedAt: '2026-08-02T12:05:00.000Z',
        },
        {
          id: 'interaction-apollo',
          targetHeroId: 'apollo',
          targetHeroName: 'Apollo',
          title: 'Respect at the Bridge',
          lines: [
            { id: 'line-2', speakerSide: 'right' as const, speakerHeroId: 'apollo', text: 'Then prove it.', order: 1 },
            { id: 'line-1', speakerSide: 'left' as const, speakerHeroId: publishedHero.id, text: 'Give me a fair fight.', order: 0 },
          ],
          createdAt: '2026-08-01T12:00:00.000Z',
          updatedAt: '2026-08-01T12:05:00.000Z',
        },
      ],
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/heroes?id=interaction_hero_1') {
        return Promise.resolve(Response.json({ hero: detailedHero }))
      }

      if (url.includes('/stats')) {
        return Promise.resolve(Response.json(stats))
      }

      return Promise.resolve(Response.json({
        heroes: [publishedHero],
        pagination: { limit: 24, offset: 0, total: 1, hasMore: false },
      }))
    })

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Browse' }))
    await user.click(await screen.findByRole('button', { name: 'View Dialogue Keeper interactions' }))

    const viewer = await screen.findByRole('dialog', { name: 'Dialogue Keeper Interactions' })
    const modal = screen.getByTestId('interaction-viewer-modal')
    const conversationRail = within(viewer).getByRole('complementary', { name: 'Interactions ordered by character' })
    const conversationButtons = within(conversationRail).getAllByRole('button')

    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?id=interaction_hero_1')
    expect(modal).toContainElement(viewer)
    expect(screen.getByTestId('interaction-creator')).toHaveAttribute('data-read-only', 'true')
    expect(conversationButtons.map(button => button.getAttribute('aria-label'))).toEqual([
      'View Apollo interaction: Respect at the Bridge',
      'View Haze interaction: A Quiet Warning',
    ])
    expect(within(viewer).getByRole('heading', { name: 'Respect at the Bridge' })).toBeInTheDocument()
    const customHeroLine = within(viewer).getByRole('textbox', { name: 'Dialogue Keeper voiceline 1' })
    const apolloLine = within(viewer).getByRole('textbox', { name: 'Apollo voiceline 2' })

    expect(customHeroLine).toHaveValue('Give me a fair fight.')
    expect(customHeroLine).toHaveAttribute('readonly')
    expect(customHeroLine.className).toContain('voicelineInput')
    expect(apolloLine).toHaveValue('Then prove it.')
    expect(apolloLine.closest('li')?.querySelector('img')).toHaveAttribute('src', '/panorama/images/heroes/fencer_sm_psd.png')
    expect(within(viewer).queryByRole('button', { name: /move line/i })).not.toBeInTheDocument()
    expect(within(viewer).queryByRole('button', { name: /add .* line/i })).not.toBeInTheDocument()

    await user.click(conversationButtons[1])

    expect(within(viewer).getByRole('heading', { name: 'A Quiet Warning' })).toBeInTheDocument()
    expect(within(viewer).getByRole('textbox', { name: 'Haze voiceline 1' })).toHaveValue('You never saw me.')

    fireEvent.mouseDown(viewer)

    expect(screen.getByRole('dialog', { name: 'Dialogue Keeper Interactions' })).toBeInTheDocument()

    fireEvent.mouseDown(modal)

    expect(screen.queryByRole('dialog', { name: 'Dialogue Keeper Interactions' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Dialogue Keeper interactions' }))
    await screen.findByRole('dialog', { name: 'Dialogue Keeper Interactions' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Dialogue Keeper Interactions' })).not.toBeInTheDocument()
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
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes?status=published&sort=trending&limit=12&offset=1')
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

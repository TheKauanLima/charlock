// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BackstoryModule from '@/components/backstory/BackstoryModule'
import HeroGrid from '@/components/HeroGrid/HeroGrid'
import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import ReportDialog from '@/components/Moderation/ReportDialog'
import { HEROES } from '@/lib/hero-data'
import type { HeroDefinition } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import { COARSE_POINTER_MEDIA_QUERY, PHONE_MEDIA_QUERY, matchesMediaQuery } from '@/lib/responsive'

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
    delete (imageProps as Record<string, unknown>).unoptimized

    return React.createElement('img', imageProps)
  },
}))

interface MockUploadButtonProps {
  endpoint: string
  content?: {
    button?: (state: { ready: boolean; isUploading: boolean; uploadProgress: number; fileTypes: string[]; files: File[] }) => React.ReactNode
  }
  onUploadBegin?: (fileName: string) => void
  onClientUploadComplete?: (files: Array<{ url: string; serverData: { url: string } }>) => void
}

vi.mock('@/lib/uploadthing', () => ({
  UploadButton: ({ endpoint, content, onUploadBegin, onClientUploadComplete }: MockUploadButtonProps) => {
    const uploadedUrl = `https://utfs.io/f/${endpoint}.png`
    const buttonLabel = content?.button?.({ ready: true, isUploading: false, uploadProgress: 0, fileTypes: ['image'], files: [] }) ?? 'Upload'

    return React.createElement('button', {
      type: 'button',
      'data-testid': `uploadthing-${endpoint}`,
      onClick: () => {
        onUploadBegin?.(`${endpoint}.png`)
        onClientUploadComplete?.([{ url: uploadedUrl, serverData: { url: uploadedUrl } }])
      },
    }, buttonLabel)
  },
  UploadDropzone: () => null,
}))

const root = process.cwd()

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

function getMediaBlocks(css: string, query: string): string[] {
  const blocks: string[] = []
  let from = 0
  for (;;) {
    const start = css.indexOf(`@media ${query}`, from)
    if (start === -1) return blocks
    const open = css.indexOf('{', start)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      if (css[i] === '}') {
        depth -= 1
        if (depth === 0) { blocks.push(css.slice(open + 1, i)); from = i; break }
      }
    }
  }
}

// Returns the joined bodies of every flat rule whose selector list contains `selector` exactly.
function getRule(css: string, selector: string) {
  const bodies: string[] = []

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(item => item.trim())

    if (selectors.includes(selector)) {
      bodies.push(match[2])
    }
  }

  return bodies.join('\n')
}

function mockMatchMedia(matchingQueries: string[]) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchingQueries.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const ARC_LIGHT = {
  id: '507f1f77bcf86cd799439011',
  slug: 'arc-light',
  assetSlug: 'arc-light',
  displayName: 'Arc Light',
  portrait: '/panorama/images/heroes/abrams.png',
  render: '/render/Abrams_Render.png',
  bookmarkedByCurrentUser: false,
  heroInfo: { ...HEROES[0].heroInfo, nameType: 'text', nameValue: 'Arc Light' },
} satisfies HeroDefinition & { id: string; bookmarkedByCurrentUser: boolean }

function mockClusterFetch(hero: HeroDefinition) {
  const stats = buildHeroStatsSeed(hero)

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('/stats')) {
      return Promise.resolve(Response.json(stats))
    }

    if (url.includes('/comments')) {
      return Promise.resolve(Response.json({
        comments: [{ id: 'comment_1', authorName: 'caseworker', content: 'Strong silhouette.', viewerCanDelete: true, createdAt: '2026-06-05T12:00:00.000Z' }],
      }))
    }

    return Promise.resolve(Response.json({}))
  })
}

async function openCreateEditorWithCustomRender(user: ReturnType<typeof userEvent.setup>) {
  render(<HeroGrid />)

  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('button', { name: 'Use EMPTY template' }))
  await user.click(screen.getByRole('button', { name: 'image' }))
  await user.click(screen.getByTestId('uploadthing-heroRender'))
  await screen.findByTestId('editor-custom-render-layer')
  await waitFor(() => expect(screen.getByTestId('hero-grid-shell').className).toContain('renderDragEnabled'))
}

// The CSSOM serializes "calc(0% + -24px)" as "calc(0% - 24px)".
function formatOffset(base: string, value: number) {
  return value < 0 ? `calc(${base} - ${-value}px)` : `calc(${base} + ${value}px)`
}

function expectRenderPosition(x: number, y: number) {
  expect(screen.getByTestId('editor-custom-render-layer')).toHaveAttribute('style', expect.stringContaining(`background-position: ${formatOffset('100%', x)} ${formatOffset('0%', y)}`))
}

beforeEach(() => {
  clerkState.isLoaded = true
  clerkState.isSignedIn = false
  clerkState.user = null
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
  Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('lib/responsive', () => {
  it('exposes the shared breakpoints and never assumes matchMedia exists', () => {
    expect(PHONE_MEDIA_QUERY).toBe('(max-width: 760px)')
    expect(matchesMediaQuery(PHONE_MEDIA_QUERY)).toBe(false)

    mockMatchMedia([PHONE_MEDIA_QUERY])
    expect(matchesMediaQuery(PHONE_MEDIA_QUERY)).toBe(true)
    expect(matchesMediaQuery('(pointer: coarse)')).toBe(false)
  })
})

describe('HeroGrid phone CSS contract', () => {
  const css = readProjectFile('components/HeroGrid/HeroGrid.module.css')
  const phone = getMediaBlocks(css, '(max-width: 760px)').join('')

  it('turns the shell into a page-scrolling block with fixed background layers', () => {
    expect(getRule(css, '.shell')).toMatch(/height:\s*100vh;\s*height:\s*100dvh;/)

    const shell = getRule(phone, '.shell')
    expect(shell).toMatch(/height:\s*auto/)
    expect(shell).toMatch(/min-height:\s*100vh;\s*min-height:\s*100dvh;/)
    expect(shell).toMatch(/overflow:\s*visible/)
    expect(shell).toMatch(/padding-bottom:\s*calc\(72px \+ var\(--safe-bottom, 0px\)\)/)

    for (const layer of ['.backgroundLayer', '.smokeLayer', '.washLayer']) {
      expect(getRule(phone, layer)).toMatch(/position:\s*fixed/)
    }
  })

  it('releases the content stacking trap and keeps the tabs bar clear of the GlobalNav avatar', () => {
    const content = getRule(phone, '.content')
    expect(content).toMatch(/position:\s*relative/)
    expect(content).toMatch(/z-index:\s*auto/)
    expect(content).toMatch(/height:\s*auto/)

    const tabs = getRule(phone, '.tabs')
    expect(tabs).toMatch(/padding:\s*calc\(6px \+ var\(--safe-top, 0px\)\) calc\(56px \+ var\(--safe-right, 0px\)\)/)
    expect(tabs).toMatch(/overflow-x:\s*auto/)
    expect(getRule(phone, '.tabsButton')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)

    // design-pass.test.ts keeps asserting the desktop base rules.
    expect(getRule(css, '.content')).toMatch(/padding:\s*66px 24px 16px/)
    expect(getRule(css, '.tabs')).toMatch(/z-index:\s*320/)
  })

  it('lays out a four-column grid without empty slots or hover-only name badges', () => {
    expect(getRule(phone, '.grid')).toMatch(/grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(getRule(phone, '.emptySlot')).toMatch(/display:\s*none/)
    expect(getRule(phone, '.heroNameBadge')).toMatch(/display:\s*none/)
    expect(getRule(phone, '.gridViewport')).toMatch(/max-height:\s*none/)
    expect(getRule(phone, '.gridViewport')).toMatch(/overflow-x:\s*clip/)
    expect(getRule(phone, '.likeButton::before')).toMatch(/inset:\s*-9px -6px/)
    expect(getRule(phone, '.loadMoreButton')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(phone, '.browseNavButton')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(phone, '.searchField input')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
  })

  it('makes the render a flowing stage with phone-only nudge controls', () => {
    const stage = getRule(phone, '.renderLayer')
    expect(stage).toMatch(/position:\s*relative/)
    expect(stage).toMatch(/height:\s*min\(60vh, 520px\);\s*height:\s*min\(60dvh, 520px\);/)
    expect(getRule(phone, '.renderLayerEmpty')).toMatch(/display:\s*none/)
    expect(getRule(css, '.renderNudge')).toMatch(/display:\s*none/)
    expect(getRule(phone, '.renderNudge')).toMatch(/display:\s*flex/)
    expect(getRule(phone, '.renderNudge button')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(getRule(phone, '.landingTitle')).toMatch(/position:\s*relative/)
  })

  it('puts touch-action: none on the draggable render frame only, never on the shell', () => {
    expect(getRule(css, '.renderDraggableFrame')).toMatch(/touch-action:\s*none/)
    expect(getRule(css, '.shell')).not.toMatch(/touch-action/)
    expect(getRule(phone, '.shell')).not.toMatch(/touch-action/)
    expect(getRule(phone, '.gridViewport')).not.toMatch(/touch-action/)
  })

  it('sizes the template modal for phones and keeps the phone block at the end of the file', () => {
    expect(getRule(phone, '.templateModal')).toMatch(/max-height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/)
    expect(getRule(phone, '.templateModal')).toMatch(/overflow-y:\s*auto/)
    expect(getRule(phone, '.templateModalClose')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(css.lastIndexOf('@media')).toBe(css.lastIndexOf('@media (max-width: 760px)'))
  })
})

describe('HeroInfoCluster and shared component CSS contract', () => {
  it('moves the cluster into the page flow with 44px social actions', () => {
    const css = readProjectFile('components/HeroInfoCluster/HeroInfoCluster.module.css')
    const phone = getMediaBlocks(css, '(max-width: 760px)').join('')
    const targets = getMediaBlocks(css, '(max-width: 760px), (pointer: coarse)').join('')
    const cluster = getRule(phone, '.cluster')

    expect(cluster).toMatch(/position:\s*relative/)
    expect(cluster).toMatch(/width:\s*auto/)
    expect(cluster).toMatch(/pointer-events:\s*auto/)
    expect(getRule(phone, '.tags')).toMatch(/flex-wrap:\s*wrap/)
    expect(getRule(phone, '.commentsModal')).toMatch(/overflow-y:\s*auto/)
    expect(getRule(targets, '.actionIconButton')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(getRule(targets, '.commentIconButton')).toMatch(/height:\s*40px/)
    expect(getRule(css, '.commentsModal')).toMatch(/calc\(100vh - 40px\)\);\s*max-height:\s*min\(680px, calc\(100dvh - 40px\)\)/)
  })

  it('turns SidebarTabs into a static row of 44px buttons', () => {
    const css = readProjectFile('components/SidebarTabs/SidebarTabs.module.css')
    const phone = getMediaBlocks(css, '(max-width: 760px)').join('')
    const tabs = getRule(phone, '.tabs')

    expect(tabs).toMatch(/position:\s*static/)
    expect(tabs).toMatch(/flex-direction:\s*row/)
    expect(tabs).toMatch(/flex-wrap:\s*wrap/)
    expect(getRule(phone, '.tabButton')).toMatch(/height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(getMediaBlocks(css, '(hover: none)').join(''), '.tabButtonInactive:hover')).toMatch(/transform:\s*none/)
  })

  it('gives the smaller shared components 40-44px touch targets', () => {
    const targetQuery = '(max-width: 760px), (pointer: coarse)'
    const variants = getMediaBlocks(readProjectFile('components/PanelVariantTabs/PanelVariantTabs.module.css'), targetQuery).join('')
    const badge = getMediaBlocks(readProjectFile('components/CreatorProfileBadge/CreatorProfileBadge.module.css'), targetQuery).join('')
    const report = getMediaBlocks(readProjectFile('components/Moderation/ReportDialog.module.css'), targetQuery).join('')
    const backstory = getMediaBlocks(readProjectFile('components/backstory/BackstoryModule.module.css'), targetQuery).join('')

    expect(getRule(variants, '.tab')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(variants, '.removeButton')).toMatch(/width:\s*40px/)
    expect(getRule(badge, '.iconBadge')).toMatch(/height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(report, '.triggerCompact')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(getRule(report, '.dialog header button')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(getRule(backstory, '.toggleButton')).toMatch(/height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(backstory, '.closeButton')).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
  })
})

describe('HeroGrid phone behaviour', () => {
  it('renders the stage after the grid content and marks it empty until a hero is selected', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    const stage = screen.getByTestId('hero-render-stage')
    const topBar = screen.getByTestId('primary-top-bar')
    const grid = screen.getByRole('region', { name: 'Select character grid' })

    expect(stage.className).toContain('renderLayerEmpty')
    expect(grid.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(topBar.compareDocumentPosition(screen.getByTestId('landing-title')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stage.parentElement).toBe(screen.getByTestId('hero-grid-shell'))

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(buildHeroStatsSeed(HEROES[0])))
    await user.click(screen.getByRole('button', { name: `Select character ${HEROES[1].displayName}` }))

    expect(screen.getByTestId('hero-render-stage').className).not.toContain('renderLayerEmpty')
    const cluster = screen.getByTestId('hero-info-cluster')
    expect(stage.compareDocumentPosition(cluster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('scrolls the stage into view after a hero tap on phones only, without requiring scrollIntoView', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(buildHeroStatsSeed(HEROES[0])))

    render(<HeroGrid />)

    // jsdom has neither matchMedia nor scrollIntoView: selecting must not throw.
    await user.click(screen.getByRole('button', { name: `Select character ${HEROES[1].displayName}` }))

    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    await user.click(screen.getByRole('button', { name: `Select character ${HEROES[2].displayName}` }))
    expect(scrollIntoView).not.toHaveBeenCalled()

    mockMatchMedia([PHONE_MEDIA_QUERY])
    await user.click(screen.getByRole('button', { name: `Select character ${HEROES[3].displayName}` }))

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }))
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId('hero-render-stage'))
  })

  it('gives the browse search field a search keyboard', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ heroes: [], pagination: { limit: 24, offset: 0, total: 0, hasMore: false } }))

    render(<HeroGrid />)
    await user.click(screen.getByRole('button', { name: 'Browse' }))

    const search = screen.getByRole('searchbox')
    expect(search).toHaveAttribute('type', 'search')
    expect(search).toHaveAttribute('inputmode', 'search')
    expect(search).toHaveAttribute('enterkeyhint', 'search')
  })

  it('nudges the custom render in 24px steps, clamps it, and resets it', async () => {
    const user = userEvent.setup()

    await openCreateEditorWithCustomRender(user)

    const nudge = screen.getByTestId('render-nudge-controls')
    expect(nudge).toHaveAttribute('role', 'group')
    expect(nudge.className).toContain('renderNudge')

    await user.click(within(nudge).getByRole('button', { name: 'Move render right' }))
    expectRenderPosition(24, 0)
    await user.click(within(nudge).getByRole('button', { name: 'Move render down' }))
    expectRenderPosition(24, 24)
    await user.click(within(nudge).getByRole('button', { name: 'Move render left' }))
    expectRenderPosition(0, 24)

    const up = within(nudge).getByRole('button', { name: 'Move render up' })
    for (let step = 0; step < 90; step += 1) {
      fireEvent.click(up)
    }
    expectRenderPosition(0, -2000)

    await user.click(within(nudge).getByRole('button', { name: 'Reset render position' }))
    expectRenderPosition(0, 0)
  })

  it('drags the render from the frame with touch on phones, but not from the shell', async () => {
    const user = userEvent.setup()

    await openCreateEditorWithCustomRender(user)
    mockMatchMedia([PHONE_MEDIA_QUERY])

    const shell = screen.getByTestId('hero-grid-shell')

    fireEvent.pointerDown(shell, { pointerId: 21, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 21, pointerType: 'touch', clientX: 160, clientY: 140 })
    fireEvent.pointerUp(window, { pointerId: 21, pointerType: 'touch', clientX: 160, clientY: 140 })
    expectRenderPosition(0, 0)

    fireEvent.pointerDown(screen.getByTestId('editor-custom-render-layer'), { pointerId: 22, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 22, pointerType: 'touch', clientX: 130, clientY: 118 })
    fireEvent.pointerUp(window, { pointerId: 22, pointerType: 'touch', clientX: 130, clientY: 118 })
    await waitFor(() => expectRenderPosition(30, 18))

    // A mouse on the shell keeps the desktop behaviour, even at phone width.
    fireEvent.pointerDown(shell, { pointerId: 23, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 23, pointerType: 'mouse', clientX: 110, clientY: 105 })
    fireEvent.pointerUp(window, { pointerId: 23, pointerType: 'mouse', clientX: 110, clientY: 105 })
    await waitFor(() => expectRenderPosition(40, 23))
  })

  it('lets a coarse pointer at tablet width drag the render from the shell, like desktop', async () => {
    const user = userEvent.setup()

    await openCreateEditorWithCustomRender(user)
    // Tablet: coarse pointer, but not phone width.
    mockMatchMedia([COARSE_POINTER_MEDIA_QUERY])

    const shell = screen.getByTestId('hero-grid-shell')

    fireEvent.pointerDown(shell, { pointerId: 24, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 24, pointerType: 'touch', clientX: 125, clientY: 112 })
    fireEvent.pointerUp(window, { pointerId: 24, pointerType: 'touch', clientX: 125, clientY: 112 })
    await waitFor(() => expectRenderPosition(25, 12))

    // Phone width with a coarse pointer still blocks shell touch drags.
    mockMatchMedia([PHONE_MEDIA_QUERY, COARSE_POINTER_MEDIA_QUERY])

    fireEvent.pointerDown(shell, { pointerId: 25, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { pointerId: 25, pointerType: 'touch', clientX: 160, clientY: 140 })
    fireEvent.pointerUp(window, { pointerId: 25, pointerType: 'touch', clientX: 160, clientY: 140 })
    expectRenderPosition(25, 12)
  })

  it('never starts a render drag from a modal backdrop', async () => {
    const user = userEvent.setup()

    await openCreateEditorWithCustomRender(user)
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const backdrop = screen.getByRole('dialog', { name: 'Choose Template' }).parentElement as HTMLElement
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')

    fireEvent.pointerDown(backdrop, { pointerId: 31, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 31, pointerType: 'mouse', clientX: 60, clientY: 60 })
    fireEvent.pointerUp(window, { pointerId: 31, pointerType: 'mouse', clientX: 60, clientY: 60 })
    expectRenderPosition(0, 0)
  })
})

describe('HeroInfoCluster phone behaviour', () => {
  it('opens ability details on tap and closes them on a second tap, an outside tap, or Escape', async () => {
    const user = userEvent.setup()
    mockClusterFetch(HEROES[0])

    render(<HeroInfoCluster hero={HEROES[0]} />)

    const abilityButton = screen.getByRole('button', { name: 'View Ability 1' })

    await user.click(abilityButton)
    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    expect(abilityButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(abilityButton)
    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()

    await user.click(abilityButton)
    await user.click(screen.getByRole('button', { name: 'View Ability 2' }))
    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Ability 2' })).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()

    await user.click(abilityButton)
    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()
  })

  it('portals the comments modal and report dialog to document.body with backdrop markers', async () => {
    const user = userEvent.setup()
    mockClusterFetch(ARC_LIGHT)

    render(<HeroInfoCluster hero={ARC_LIGHT} />)

    await user.click(screen.getByRole('button', { name: 'Open Arc Light comments' }))

    const commentsDialog = await screen.findByRole('dialog', { name: 'Arc Light comments' })
    const commentsBackdrop = commentsDialog.parentElement as HTMLElement

    expect(commentsBackdrop.parentElement).toBe(document.body)
    expect(commentsBackdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(screen.getByTestId('hero-info-cluster')).not.toContainElement(commentsDialog)
    expect(screen.getByLabelText('Comment')).toHaveAttribute('inputmode', 'text')

    await within(commentsDialog).findByText('Strong silhouette.')
    await user.click(within(commentsDialog).getByRole('button', { name: 'Report comment' }))

    const reportDialog = screen.getByRole('dialog', { name: 'Report comment' })
    expect(reportDialog.parentElement?.parentElement).toBe(document.body)

    // Tapping the report backdrop closes only the report dialog.
    fireEvent.pointerDown(reportDialog.parentElement as HTMLElement, { pointerType: 'touch' })
    fireEvent.click(reportDialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'Report comment' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Arc Light comments' })).toBeInTheDocument()

    fireEvent.pointerDown(commentsBackdrop, { pointerType: 'touch' })
    fireEvent.click(commentsBackdrop)
    expect(screen.queryByRole('dialog', { name: 'Arc Light comments' })).not.toBeInTheDocument()
  })
})

describe('modal backdrop tap-to-close', () => {
  it('closes the backstory modal from a touch tap on the backdrop, but not from a press that started in the dialog', async () => {
    const user = userEvent.setup()

    render(<BackstoryModule hero={HEROES[0]} />)

    await user.click(screen.getByRole('button', { name: `View ${HEROES[0].displayName} character backstory` }))

    const backdrop = screen.getByTestId('backstory-backdrop')
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')

    fireEvent.pointerDown(screen.getByRole('dialog'), { pointerType: 'touch' })
    fireEvent.click(backdrop)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.pointerDown(backdrop, { pointerType: 'touch' })
    fireEvent.pointerUp(backdrop, { pointerType: 'touch' })
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `View ${HEROES[0].displayName} character backstory` }))
    await user.click(screen.getByTestId('backstory-backdrop'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('portals the report dialog and closes it from a backdrop tap', async () => {
    const user = userEvent.setup()

    render(<ReportDialog endpoint="/api/heroes/hero_1/report" contentLabel="character" compact />)

    await user.click(screen.getByRole('button', { name: 'Report character' }))

    const backdrop = screen.getByRole('dialog', { name: 'Report character' }).parentElement as HTMLElement
    expect(backdrop.parentElement).toBe(document.body)
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')

    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

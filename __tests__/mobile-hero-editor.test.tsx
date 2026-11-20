// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import EditorAssetModal from '@/components/EditorAssetModal/EditorAssetModal'
import HeroGrid from '@/components/HeroGrid/HeroGrid'
import InteractionCreator from '@/components/InteractionCreator/InteractionCreator'
import { buildCharacterExportPayload } from '@/lib/character-export'
import type { HeroInteraction } from '@/lib/custom-hero-types'
import { HERO_BACKGROUND_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  user: null as { id: string } | null,
}))

const imageMocks = vi.hoisted(() => ({
  toPng: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => clerkState,
}))

vi.mock('html-to-image', () => ({
  toPng: imageMocks.toPng,
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
    const start = css.indexOf(`@media ${query} {`, from)
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

const PHONE = '(max-width: 760px)'
const TARGETS = '(max-width: 760px), (pointer: coarse)'
const DVH_MAX_HEIGHT = /max-height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/

async function openEmptyCreateEditor(user: ReturnType<typeof userEvent.setup>) {
  render(<HeroGrid />)

  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('button', { name: 'Use EMPTY template' }))
}

function tapBackdrop(backdrop: HTMLElement) {
  fireEvent.pointerDown(backdrop, { pointerType: 'touch' })
  fireEvent.pointerUp(backdrop, { pointerType: 'touch' })
  fireEvent.click(backdrop)
}

beforeEach(() => {
  clerkState.isLoaded = true
  clerkState.isSignedIn = false
  clerkState.user = null
  imageMocks.toPng.mockResolvedValue('data:image/png;base64,card')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('HeroInfoEditor phone CSS contract', () => {
  const css = readProjectFile('components/HeroInfoEditor/HeroInfoEditor.module.css')
  const phone = getMediaBlocks(css, PHONE).join('\n')
  const targets = getMediaBlocks(css, TARGETS).join('\n')
  const coarse = getMediaBlocks(css, '(pointer: coarse)').join('\n')

  it('appends the phone block after every other query', () => {
    expect(phone).not.toBe('')
    expect(css.lastIndexOf(`@media ${PHONE} {`)).toBeGreaterThan(css.lastIndexOf('@media (max-width: 640px)'))
    expect(css.lastIndexOf(`@media ${PHONE} {`)).toBeGreaterThan(css.lastIndexOf('@media (max-width: 1024px)'))
  })

  it('flows the editor below the stage without viewport offsets', () => {
    const editor = getRule(phone, '.editor')

    expect(editor).toMatch(/position:\s*relative/)
    expect(editor).toMatch(/inset:\s*auto/)
    expect(editor).toMatch(/display:\s*flex/)
    expect(editor).toMatch(/flex-direction:\s*column/)
    expect(editor).toMatch(/pointer-events:\s*auto/)
    // Not a stacking context on phone, so the fixed ability sheet (z 400) clears the tab bar and GlobalNav.
    expect(editor).toMatch(/z-index:\s*auto/)
    expect(editor).toMatch(/padding:\s*12px calc\(var\(--mobile-gutter, 12px\)/)
  })

  it('makes the preview stage, stats aside and rail relative, full width and offset-free', () => {
    const stage = getRule(phone, '.previewStageRailCollapsed')
    const aside = getRule(phone, '.statsAside')
    const rail = getRule(phone, '.controlRailCollapsed')

    expect(getRule(phone, '.previewStage')).toBe(stage)
    expect(getRule(phone, '.controlRail')).toBe(rail)

    for (const body of [stage, aside, rail]) {
      expect(body).toMatch(/position:\s*relative/)
      expect(body).not.toMatch(/position:\s*(absolute|fixed)/)
      expect(body).not.toMatch(/(top|right|bottom|left):\s*-?\d/)
      expect(body).not.toMatch(/vw/)
    }

    expect(stage).toMatch(/width:\s*auto/)
    expect(stage).toMatch(/min-height:\s*0/)
    expect(aside).toMatch(/width:\s*auto/)
    expect(rail).toMatch(/width:\s*auto/)
    expect(rail).toMatch(/min-width:\s*0/)
    expect(rail).toMatch(/display:\s*flex/)
    expect(rail).toMatch(/flex-direction:\s*column/)
    expect(getRule(phone, '.tagsRow')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('moves the rail toggle to the top as a full-width 44px bar and hides the collapsed pane', () => {
    const toggle = getRule(phone, '.controlRailToggle')

    expect(toggle).toMatch(/position:\s*relative/)
    expect(toggle).toMatch(/order:\s*-1/)
    expect(toggle).toMatch(/width:\s*100%/)
    expect(toggle).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
    expect(toggle).toMatch(/flex-direction:\s*row/)
    expect(getRule(phone, '.controlRailToggle strong')).toMatch(/writing-mode:\s*horizontal-tb/)
    expect(getRule(phone, '.controlRailCollapsed .controlPane')).toMatch(/display:\s*none/)
    expect(getRule(phone, '.controlTabRail')).toMatch(/flex-direction:\s*row/)
    expect(getRule(phone, '.controlTabRail')).toMatch(/flex-wrap:\s*wrap/)
    expect(getRule(phone, '.controlTabList')).toMatch(/flex-direction:\s*row/)
    expect(getRule(phone, '.controlPane')).toMatch(/overflow:\s*visible/)
    expect(getRule(phone, '.railContent')).toMatch(/overflow:\s*visible/)
  })

  it('keeps 44px targets on rail controls, actions and the in-editor modals', () => {
    for (const selector of ['.previewModeButton', '.segmentedButton', '.input', '.select', '.saveActionButton', '.publishActionButton', '.exportActionButton', '.exitStayButton', '.exitConfirmButton']) {
      expect(getRule(targets, selector)).toMatch(/min-height:\s*var\(--touch-target, 44px\)/)
    }

    expect(getRule(targets, '.secondSetModalClose')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(getRule(phone, '.controlTabButton')).toMatch(/min-width:\s*56px/)
    expect(getRule(phone, '.secondSetModal')).toMatch(DVH_MAX_HEIGHT)
    expect(getRule(phone, '.exitConfirmDialog')).toMatch(DVH_MAX_HEIGHT)
  })

  it('grows the tag handle hit areas to 28px corners and 20px edges on coarse pointers', () => {
    // Base visuals: 14px corners, 12px edges. The ::before hit area adds the inset on each side.
    expect(getRule(css, '.tagCornerHandle')).toMatch(/width:\s*14px/)
    expect(getRule(css, '.tagEdgeHandle')).toMatch(/height:\s*12px/)
    expect(getRule(css, '.tagSideEdgeHandle')).toMatch(/width:\s*12px/)
    expect(getRule(coarse, '.tagDragHandle::before')).toMatch(/position:\s*absolute/)
    expect(getRule(coarse, '.tagDragHandle::before')).toMatch(/content:\s*""/)
    expect(getRule(coarse, '.tagCornerHandle::before')).toMatch(/inset:\s*-7px/)
    expect(getRule(coarse, '.tagEdgeHandle::before')).toMatch(/inset:\s*-4px 0/)
    expect(getRule(coarse, '.tagSideEdgeHandle::before')).toMatch(/inset:\s*0 -4px/)
    expect(getRule(coarse, '.tagDragHandle::after')).toMatch(/border-color:\s*rgba\(255, 239, 214, 0\.28\)/)
  })
})

describe('editor modal CSS contract', () => {
  it('lifts and sizes the asset and export modals for phones', () => {
    const asset = readProjectFile('components/EditorAssetModal/EditorAssetModal.module.css')
    const exportCss = readProjectFile('components/CharacterExport/CharacterExportButton.module.css')

    for (const css of [asset, exportCss]) {
      const zIndex = Number(css.match(/\.backdrop\s*\{[^}]*z-index:\s*(\d+)/)?.[1])
      const phone = getMediaBlocks(css, PHONE).join('\n')

      expect(zIndex).toBeGreaterThanOrEqual(400)
      expect(getRule(phone, '.modal')).toMatch(DVH_MAX_HEIGHT)
      expect(getRule(phone, '.modal')).toMatch(/width:\s*min\(100%/)
      expect(getRule(phone, '.backdrop')).toMatch(/padding:/)
      expect(getRule(getMediaBlocks(css, TARGETS).join('\n'), '.closeButton')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    }

    expect(getRule(getMediaBlocks(asset, PHONE).join('\n'), '.assetList')).toMatch(/overscroll-behavior:\s*contain/)
    expect(getRule(getMediaBlocks(exportCss, PHONE).join('\n'), '.modalHeader')).toMatch(/position:\s*sticky/)
  })

  it('flows the interaction creator on phone and lifts its pickers above the interaction viewer', () => {
    const css = readProjectFile('components/InteractionCreator/InteractionCreator.module.css')
    const phone = getMediaBlocks(css, PHONE).join('\n')
    const creator = getRule(phone, '.creatorPaneCollapsed')

    expect(css).toMatch(/\.modalBackdrop\s*\{[^}]*z-index:\s*2300/)
    expect(getRule(phone, '.creator')).toBe(creator)
    expect(creator).toMatch(/position:\s*relative/)
    expect(creator).toMatch(/inset:\s*auto/)
    expect(creator).toMatch(/left:\s*auto/)
    expect(creator).toMatch(/min-height:\s*0/)
    expect(getRule(phone, '.creatorViewer')).toMatch(/height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/)
    expect(getRule(phone, '.conversationModal')).toMatch(DVH_MAX_HEIGHT)
    expect(getRule(getMediaBlocks(css, TARGETS).join('\n'), '.iconButton')).toMatch(/width:\s*var\(--touch-target, 44px\)/)
  })

  it('always shows 40px line actions on touch devices and on phones', () => {
    const css = readProjectFile('components/InteractionCreator/InteractionCreator.module.css')

    for (const block of [getMediaBlocks(css, '(hover: none)').join('\n'), getMediaBlocks(css, PHONE).join('\n')]) {
      expect(getRule(block, '.lineActions')).toMatch(/opacity:\s*1/)
      expect(getRule(block, '.lineActions')).toMatch(/position:\s*static/)
      expect(getRule(block, '.lineActions button')).toMatch(/width:\s*40px/)
      expect(getRule(block, '.lineActions button')).toMatch(/height:\s*40px/)
    }
  })

  it('pairs every 100vh with a 100dvh fallback in the step 4 stylesheets', () => {
    const files = [
      'components/HeroInfoEditor/HeroInfoEditor.module.css',
      'components/EditorAssetModal/EditorAssetModal.module.css',
      'components/CharacterExport/CharacterExportButton.module.css',
      'components/InteractionCreator/InteractionCreator.module.css',
    ]

    for (const file of files) {
      const lines = readProjectFile(file).split(/\r?\n/)

      lines.forEach((line, index) => {
        if (!line.includes('100vh')) return
        expect(lines[index + 1], `${file}:${index + 1}`).toBe(line.replace(/100vh/g, '100dvh'))
      })
    }
  })
})

describe('HeroInfoEditor phone behaviour', () => {
  it('rotates and moves tags from touch handle drags', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)

    const tag = screen.getByTestId('editor-tag-1')
    const rotateHandle = screen.getByLabelText('Tag 1 rotate bottom left handle')

    fireEvent.pointerDown(rotateHandle, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0, pointerId: 41 })
    fireEvent.pointerMove(rotateHandle, { pointerType: 'touch', clientX: 30, clientY: 0, pointerId: 41 })
    fireEvent.pointerUp(rotateHandle, { pointerType: 'touch', pointerId: 41 })
    expect(tag).toHaveStyle({ transform: 'translateY(0px) rotate(5deg)' })

    const moveHandle = screen.getByLabelText('Tag 1 vertical right edge handle')

    fireEvent.pointerDown(moveHandle, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0, pointerId: 42 })
    fireEvent.pointerMove(moveHandle, { pointerType: 'touch', clientX: 0, clientY: 10, pointerId: 42 })
    fireEvent.pointerCancel(moveHandle, { pointerType: 'touch', pointerId: 42 })
    expect(tag).toHaveStyle({ transform: 'translateY(10px) rotate(5deg)' })

    // After the touch ends, further moves do nothing.
    fireEvent.pointerMove(moveHandle, { pointerType: 'touch', clientX: 0, clientY: 40, pointerId: 42 })
    expect(tag).toHaveStyle({ transform: 'translateY(10px) rotate(5deg)' })
  })

  it('offers step buttons as a non-drag alternative for tag tilt and offset', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)

    const controls = screen.getByTestId('tag-transform-controls')
    const tag = screen.getByTestId('editor-tag-2')
    const tagGroup = within(controls).getByRole('group', { name: 'Tag 2 adjustments' })
    const reset = within(tagGroup).getByRole('button', { name: 'Reset Tag 2 tilt and offset' })

    expect(reset).toBeDisabled()

    await user.click(within(tagGroup).getByRole('button', { name: 'Rotate Tag 2 clockwise' }))
    await user.click(within(tagGroup).getByRole('button', { name: 'Rotate Tag 2 clockwise' }))
    await user.click(within(tagGroup).getByRole('button', { name: 'Rotate Tag 2 counterclockwise' }))
    await user.click(within(tagGroup).getByRole('button', { name: 'Move Tag 2 down' }))
    expect(tag).toHaveStyle({ transform: 'translateY(2px) rotate(2deg)' })
    expect(screen.getByTestId('tag-2-tilt-value')).toHaveTextContent('2°')
    expect(screen.getByTestId('tag-2-offset-value')).toHaveTextContent('2px')

    for (let index = 0; index < 20; index += 1) {
      await user.click(within(tagGroup).getByRole('button', { name: 'Move Tag 2 up' }))
    }

    expect(tag).toHaveStyle({ transform: 'translateY(-28px) rotate(2deg)' })

    await user.click(reset)
    expect(tag).toHaveStyle({ transform: 'translateY(0px) rotate(0deg)' })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'translateY(0px) rotate(0deg)' })
  })

  it('collapses and expands the settings rail from a tap on its toggle', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)

    const rail = screen.getByTestId('editor-control-rail')
    const toggle = within(rail).getByRole('button', { name: 'Retract editor settings panel' })

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.pointerDown(toggle, { pointerType: 'touch' })
    fireEvent.click(toggle)
    expect(rail).toHaveAttribute('data-collapsed', 'true')
    expect(within(rail).getByRole('button', { name: 'Expand editor settings panel' })).toHaveAttribute('aria-expanded', 'false')

    // Choosing a rail tab while collapsed re-opens the pane.
    await user.click(within(rail).getByRole('tab', { name: 'Color settings' }))
    expect(rail).not.toHaveAttribute('data-collapsed')
  })

  it('portals the exit confirmation and second ability set modals out of the editor with backdrop markers', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)

    const editor = screen.getByTestId('hero-info-editor')

    await user.click(within(editor).getByRole('button', { name: 'Go Back' }))
    const exitDialog = screen.getByRole('dialog', { name: 'Go back to the main pages?' })

    expect(editor).not.toContainElement(exitDialog)
    expect(exitDialog.parentElement?.parentElement).toBe(document.body)
    expect(exitDialog.parentElement).toHaveAttribute('data-modal-backdrop', 'true')
    await user.click(screen.getByRole('button', { name: 'Stay here' }))

    await user.click(screen.getByRole('tab', { name: 'Editor options' }))
    await user.click(screen.getByLabelText('Second Ability Set'))
    const secondSetDialog = screen.getByTestId('second-ability-set-modal')

    expect(editor).not.toContainElement(secondSetDialog)
    expect(secondSetDialog.parentElement?.parentElement).toBe(document.body)
    expect(secondSetDialog.parentElement).toHaveAttribute('data-modal-backdrop', 'true')
  })

  it('opens the background picker on document.body and closes it from a backdrop tap', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)
    await user.click(screen.getByRole('tab', { name: 'Image settings' }))
    await user.click(screen.getByTestId('editor-background-picker'))

    const modal = screen.getByTestId('background-modal')

    expect(modal.parentElement).toBe(document.body)
    expect(screen.getByTestId('hero-info-editor')).not.toContainElement(modal)
    tapBackdrop(modal)
    expect(screen.queryByTestId('background-modal')).not.toBeInTheDocument()
  })

  it('opens the export preview on document.body from inside the rail', async () => {
    const user = userEvent.setup()

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    await openEmptyCreateEditor(user)

    const rail = screen.getByTestId('editor-control-rail')

    await user.click(within(rail).getByRole('button', { name: /export character/i }))
    const dialog = screen.getByRole('dialog', { name: 'Export character card' })

    expect(dialog.parentElement).toBe(document.body)
    expect(rail).not.toContainElement(dialog)
    expect(await screen.findByText('Preview ready.')).toBeInTheDocument()
  })

  it('gives the numeric rail inputs a decimal keypad', async () => {
    const user = userEvent.setup()

    await openEmptyCreateEditor(user)

    expect(screen.getByLabelText('Font size value')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Draft autosave interval value')).toHaveAttribute('inputmode', 'decimal')
  })
})

describe('CharacterExport modal', () => {
  function renderExport() {
    const hero = HEROES[0]

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    return render(
      <div style={{ backdropFilter: 'blur(24px)' }} data-testid="rail-like-parent">
        <CharacterExportButton payload={buildCharacterExportPayload(hero, buildHeroStatsSeed(hero))} />
      </div>,
    )
  }

  it('portals to document.body with the backdrop marker and closes from a backdrop tap only', async () => {
    const user = userEvent.setup()

    renderExport()
    await user.click(screen.getByRole('button', { name: /export character/i }))

    const backdrop = screen.getByRole('dialog', { name: 'Export character card' })

    expect(backdrop.parentElement).toBe(document.body)
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(screen.getByTestId('rail-like-parent')).not.toContainElement(backdrop)
    expect(await screen.findByRole('status')).toHaveTextContent('Preview ready.')

    // A press that starts inside the surface never closes the modal.
    fireEvent.pointerDown(screen.getByRole('button', { name: /download png/i }), { pointerType: 'touch' })
    fireEvent.click(backdrop)
    expect(screen.getByRole('dialog', { name: 'Export character card' })).toBeInTheDocument()

    tapBackdrop(backdrop)
    expect(screen.queryByRole('dialog', { name: 'Export character card' })).not.toBeInTheDocument()
  })

  it('closes on Escape and from the 44px close button', async () => {
    const user = userEvent.setup()

    renderExport()
    await user.click(screen.getByRole('button', { name: /export character/i }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Export character card' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /export character/i }))
    await user.click(screen.getByRole('button', { name: 'Close export preview' }))
    expect(screen.queryByRole('dialog', { name: 'Export character card' })).not.toBeInTheDocument()
  })
})

describe('EditorAssetModal', () => {
  it('portals with the marker, closes from a backdrop tap or Escape, and selects assets without closing itself', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSelect = vi.fn()

    render(
      <section style={{ position: 'relative', zIndex: 30 }} data-testid="editor-like-parent">
        <EditorAssetModal
          title="Background"
          description="Choose a hero background for the editor stage."
          groups={HERO_BACKGROUND_GROUPS}
          previewMode="image"
          testId="background-modal"
          onClose={onClose}
          onSelect={onSelect}
        />
      </section>,
    )

    const backdrop = screen.getByTestId('background-modal')

    expect(backdrop.parentElement).toBe(document.body)
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(backdrop).toHaveClass('pointer-events-auto')
    expect(screen.getByTestId('editor-like-parent')).not.toContainElement(backdrop)

    await user.click(within(backdrop).getByRole('button', { name: 'Use Yamato' }))
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('yamato'))
    expect(onClose).not.toHaveBeenCalled()

    tapBackdrop(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('InteractionCreator phone behaviour', () => {
  function Harness({ initialInteractions = [] }: { initialInteractions?: HeroInteraction[] }) {
    const [interactions, setInteractions] = useState(initialInteractions)

    return (
      <InteractionCreator
        customHeroId="custom-hero-1"
        customHeroName="Aurora"
        customHeroPortrait="/panorama/images/heroes/abrams.png"
        accentColor="#72d6ff"
        interactions={interactions}
        onChange={setInteractions}
      />
    )
  }

  it('portals the target picker with the accent, marker and a search keyboard, and closes it from a backdrop tap', async () => {
    const user = userEvent.setup()

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /new conversation/i }))

    const dialog = screen.getByRole('dialog', { name: /choose target hero/i })
    const backdrop = dialog.parentElement as HTMLElement

    expect(backdrop.parentElement).toBe(document.body)
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(backdrop.style.getPropertyValue('--interaction-accent')).toBe('#72d6ff')
    expect(screen.getByTestId('interaction-creator')).not.toContainElement(dialog)
    expect(within(dialog).getByPlaceholderText('Search heroes')).toHaveAttribute('inputmode', 'search')

    fireEvent.pointerDown(dialog, { pointerType: 'touch' })
    fireEvent.click(backdrop)
    expect(screen.getByRole('dialog', { name: /choose target hero/i })).toBeInTheDocument()

    tapBackdrop(backdrop)
    expect(screen.queryByRole('dialog', { name: /choose target hero/i })).not.toBeInTheDocument()
  })

  it('closes the conversation picker on Escape and keeps line actions in the DOM for touch', async () => {
    const user = userEvent.setup()
    const interaction: HeroInteraction = {
      id: 'interaction-1',
      targetHeroId: 'bebop',
      targetHeroName: 'Bebop',
      title: 'Lane Partner Banter',
      lines: [{ id: 'line-1', speakerSide: 'left', speakerHeroId: 'custom-hero-1', text: 'Hi', order: 0 }],
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    }

    render(<Harness initialInteractions={[interaction]} />)

    await user.click(screen.getByRole('button', { name: /conversations/i }))
    const dialog = screen.getByRole('dialog', { name: 'Conversations' })

    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(within(dialog).getByPlaceholderText('Filter conversations')).toHaveAttribute('inputmode', 'search')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Conversations' })).not.toBeInTheDocument()

    expect(screen.getByLabelText('Line 1 actions')).toContainElement(screen.getByRole('button', { name: 'Delete line 1' }))
    await user.click(screen.getByRole('button', { name: 'Delete line 1' }))
    expect(screen.queryByRole('textbox', { name: 'Aurora voiceline 1' })).not.toBeInTheDocument()
  })
})

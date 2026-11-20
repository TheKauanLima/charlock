// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import CommittedColorInput from '@/components/CommittedColorInput/CommittedColorInput'
import IconSearchModal from '@/components/IconSearchModal/IconSearchModal'
import HeroStatsBoonPanel from '@/components/panels/hero-stats-boon-panel'
import { HeroStatsSpiritPanel, ScalingPicker, WeaponPanel, buildWeaponStatsArray } from '@/components/panels'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

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

function getRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')

  return css.match(new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

function readCss(path: string) {
  return readFileSync(path, 'utf8')
}

// The trailing brace keeps the phone-only query from also matching the combined query.
const PHONE = '(max-width: 760px) {'
const PHONE_OR_COARSE = '(max-width: 760px), (pointer: coarse)'

function renderEditor(mode: 'edit' | 'preview' = 'edit') {
  const onSave = vi.fn()
  const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

  render(
    <AbilityEditor
      ability={ability}
      mode={mode}
      propertyIconGroups={PROPERTY_ICON_GROUPS}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  )

  return { onSave }
}

function getSectionOrder() {
  return screen.getAllByRole('button', { name: /^Reorder .* section$/ }).map(button => button.getAttribute('aria-label'))
}

function selectEditorText(editor: HTMLElement, length: number) {
  const textNode = editor.firstChild

  if (!textNode) {
    throw new Error('Rich text editor has no text node')
  }

  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, length)
  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)
}

describe('AbilityEditor section reorder without drag', () => {
  it('moves sections up and down with buttons and disables them at the ends', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    expect(getSectionOrder()).toEqual(['Reorder Description section', 'Reorder Impact section'])

    const descriptionUp = screen.getByRole('button', { name: 'Move Description section up' })
    const descriptionDown = screen.getByRole('button', { name: 'Move Description section down' })
    const impactUp = screen.getByRole('button', { name: 'Move Impact section up' })
    const impactDown = screen.getByRole('button', { name: 'Move Impact section down' })

    expect(descriptionUp).toBeDisabled()
    expect(descriptionDown).toBeEnabled()
    expect(impactUp).toBeEnabled()
    expect(impactDown).toBeDisabled()

    await user.click(impactUp)

    expect(getSectionOrder()).toEqual(['Reorder Impact section', 'Reorder Description section'])
    expect(screen.getByRole('button', { name: 'Move Impact section up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Description section down' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Move Impact section down' }))

    expect(getSectionOrder()).toEqual(['Reorder Description section', 'Reorder Impact section'])

    await user.click(screen.getByRole('button', { name: 'Move Description section down' }))
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    expect(onSave.mock.calls[0]?.[0].sections.map((section: { title: string }) => section.title)).toEqual(['Impact', 'Description'])
  })

  it('renders the move buttons next to the drag handle and remove button', () => {
    renderEditor()

    const section = screen.getByRole('button', { name: 'Reorder Description section' }).closest('article')

    expect(section).not.toBeNull()
    expect(within(section!).getAllByRole('button').slice(0, 4).map(button => button.getAttribute('aria-label'))).toEqual([
      'Reorder Description section',
      'Move Description section up',
      'Move Description section down',
      'Remove Description section',
    ])
  })

  it('hides the move buttons when the editor is read-only', () => {
    renderEditor('preview')

    expect(screen.queryByRole('button', { name: /^Move .* section (up|down)$/ })).not.toBeInTheDocument()
  })
})

describe('AbilityEditor rich-text toolbar on touch', () => {
  it('cancels touch and pen pointerdown on every toolbar button so the editor keeps its selection', () => {
    renderEditor()

    for (const name of ['Bold selected text', 'Italicize selected text', 'Darken selected text', 'Open text color swatches', 'Inline Icon']) {
      const button = screen.getByRole('button', { name })

      expect(fireEvent.pointerDown(button, { pointerType: 'touch' })).toBe(false)
      expect(fireEvent.pointerDown(button, { pointerType: 'pen' })).toBe(false)
    }
  })

  it('leaves mouse pointerdown alone and cancels the mousedown instead, as on desktop before', () => {
    renderEditor()

    for (const name of ['Bold selected text', 'Italicize selected text', 'Darken selected text', 'Open text color swatches', 'Inline Icon']) {
      const button = screen.getByRole('button', { name })

      expect(fireEvent.pointerDown(button, { pointerType: 'mouse' })).toBe(true)
      expect(fireEvent.mouseDown(button)).toBe(false)
    }
  })

  it('applies bold after a mouse press even when the live selection collapsed before the click', () => {
    renderEditor()

    const editor = screen.getByRole('textbox', { name: 'Description rich text' })
    const bold = screen.getByRole('button', { name: 'Bold selected text' })

    selectEditorText(editor, 6)
    fireEvent.pointerDown(bold, { pointerType: 'mouse' })
    fireEvent.mouseDown(bold)
    window.getSelection()?.removeAllRanges()
    fireEvent.click(bold)

    expect(editor.querySelector('strong')?.textContent).toHaveLength(6)
  })

  it('applies bold after a touch press even when the live selection collapsed before the click', () => {
    renderEditor()

    const editor = screen.getByRole('textbox', { name: 'Description rich text' })
    const bold = screen.getByRole('button', { name: 'Bold selected text' })

    selectEditorText(editor, 6)
    fireEvent.pointerDown(bold, { pointerType: 'touch' })
    // A touch browser may drop the live selection between touchstart and click.
    window.getSelection()?.removeAllRanges()
    fireEvent.click(bold)

    expect(editor.querySelector('strong')?.textContent).toHaveLength(6)
  })

  it('remembers a selection made without mouseup (long-press handles) via selectionchange', () => {
    renderEditor()

    const editor = screen.getByRole('textbox', { name: 'Description rich text' })

    selectEditorText(editor, 6)
    fireEvent(document, new Event('selectionchange'))
    window.getSelection()?.removeAllRanges()
    fireEvent.click(screen.getByRole('button', { name: 'Italicize selected text' }))

    expect(editor.querySelector('em')?.textContent).toHaveLength(6)
  })

  it('forwards onPointerDown from CommittedColorInput', () => {
    const onPointerDown = vi.fn()

    render(<CommittedColorInput value="#ffffff" ariaLabel="Custom text color" onCommit={vi.fn()} onPointerDown={onPointerDown} />)
    fireEvent.pointerDown(screen.getByLabelText('Custom text color'))

    expect(onPointerDown).toHaveBeenCalledTimes(1)
  })
})

describe('Icon pickers on touch', () => {
  it('closes the icon search modal when the backdrop is tapped', () => {
    const onClose = vi.fn()

    render(
      <IconSearchModal
        groups={PROPERTY_ICON_GROUPS}
        search=""
        selectedIconColor=""
        onIconColorChange={vi.fn()}
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    )

    const backdrop = screen.getByTestId('property-icon-modal')

    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(backdrop.parentElement).toBe(document.body)

    const searchInput = within(backdrop).getByPlaceholderText('Search property icons')

    expect(searchInput).toHaveAttribute('type', 'search')
    expect(searchInput).toHaveAttribute('inputmode', 'search')
    expect(searchInput).toHaveAttribute('enterkeyhint', 'search')
    expect(searchInput).toHaveAttribute('autocomplete', 'off')
    expect(searchInput).toHaveAttribute('autocapitalize', 'none')
    expect(searchInput).toHaveAttribute('spellcheck', 'false')

    fireEvent.pointerDown(searchInput)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.pointerDown(backdrop, { pointerType: 'touch' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the boon stat icon picker when the backdrop is tapped', async () => {
    const user = userEvent.setup()

    render(<HeroStatsBoonPanel heroName="Abrams" isEditable onStatsChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Change Base Bullet Damage icon' }))

    const backdrop = screen.getByTestId('boon-stat-icon-modal')

    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    fireEvent.pointerDown(screen.getByTestId('boon-stat-icon-picker'))
    expect(screen.getByTestId('boon-stat-icon-modal')).toBeInTheDocument()

    fireEvent.pointerDown(backdrop, { pointerType: 'touch' })
    expect(screen.queryByTestId('boon-stat-icon-modal')).not.toBeInTheDocument()
  })

  it('closes the scaling picker popover on an outside tap', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [openId, setOpenId] = useState<string | null>(null)

      return (
        <div>
          <button type="button">Outside</button>
          <ScalingPicker label="Range" scaling="none" scalingValue="0" openPickerId={openId} onChange={vi.fn()} onOpenPickerChange={setOpenId} />
        </div>
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Edit Range scaling' }))
    expect(screen.getByRole('dialog', { name: 'Range scaling controls' })).toBeInTheDocument()
    expect(screen.getByLabelText('Range scaling value')).toHaveAttribute('inputmode', 'text')

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }), { pointerType: 'touch' })
    expect(screen.queryByRole('dialog', { name: 'Range scaling controls' })).not.toBeInTheDocument()
  })
})

describe('Panels numeric inputs', () => {
  it('uses the full keyboard (with a minus key on iOS) for panel values, which may be negative', () => {
    render(<HeroStatsSpiritPanel isEditable />)

    for (const input of within(screen.getByTestId('hero-stats-spirit-panel')).getAllByLabelText(/ value$/)) {
      expect(input).toHaveAttribute('inputmode', 'text')
    }

    cleanup()
    render(<WeaponPanel isEditable weaponStats={buildWeaponStatsArray()} weaponMinRange="20" weaponMaxRange="50" onWeaponMinRangeChange={vi.fn()} onWeaponMaxRangeChange={vi.fn()} />)

    expect(screen.getByLabelText('Minimum falloff range')).toHaveAttribute('inputmode', 'text')
    expect(screen.getByLabelText('Maximum falloff range')).toHaveAttribute('inputmode', 'text')
    expect(screen.getByLabelText('Bullet Damage value')).toHaveAttribute('inputmode', 'text')

    cleanup()
    render(<HeroStatsBoonPanel heroName="Abrams" isEditable onStatsChange={vi.fn()} />)

    expect(screen.getByLabelText('Base Bullet Damage value')).toHaveAttribute('inputmode', 'text')
  })
})

describe('Mobile ability editor CSS contract', () => {
  const abilityCss = readCss('components/AbilityEditor/AbilityEditor.module.css')
  // The step 5 phone block is the last one; an older 760px block exists mid-file.
  const phone = getMediaBlocks(abilityCss, PHONE).at(-1) ?? ''
  const phoneOrCoarse = getMediaBlocks(abilityCss, PHONE_OR_COARSE).join('\n')

  it('turns the focus shell into a full-screen sheet above the GlobalNav on phones', () => {
    const shellRule = getRule(phone, '.focusShell,\n  .focusShell.focusShellPreview')

    expect(shellRule).toMatch(/z-index:\s*400/)
    expect(shellRule).toMatch(/pointer-events:\s*auto/)
    expect(shellRule).toMatch(/height:\s*100vh;\s*height:\s*100dvh/)
    expect(shellRule).toMatch(/background:/)
    expect(abilityCss).not.toMatch(/\.focusShell:not\(\.focusShellPreview\) \.focusBackdrop/)
    expect(abilityCss).not.toMatch(/backdrop-filter:\s*blur\(1px\)/)
    // The desktop base rule stays untouched (design-pass asserts it).
    expect(getRule(abilityCss, '.focusShell')).toMatch(/z-index:\s*360/)
  })

  it('puts the hero info cluster in flow above the editor column on phones', () => {
    expect(getRule(phone, '.heroInfoCluster')).toMatch(/position:\s*relative/)
    expect(getRule(phone, '.heroInfoCluster')).toMatch(/grid-row:\s*1/)
    expect(getRule(phone, '.editorLayout,\n  .editorLayoutPreview')).toMatch(/grid-row:\s*2/)
    expect(getRule(phone, '.mainEditorColumn,\n  .mainEditorColumnPreview,\n  .mainEditorColumnEditorPreview')).toMatch(/max-height:\s*none/)
  })

  it('keeps editable contenteditable text at 16px or more on phones and coarse pointers', () => {
    expect(getRule(phoneOrCoarse, '.richEditable')).toMatch(/font-size:\s*max\(16px,\s*1rem\)/)
    expect(getRule(phoneOrCoarse, '.tierTextEditorCompact:not(.tierTextEditorReadOnly),\n  .tierTextEditorTiny:not(.tierTextEditorReadOnly)')).toMatch(/font-size:\s*max\(16px,\s*1rem\)/)
  })

  it('wraps the rich-text toolbar with 40px buttons', () => {
    expect(getRule(abilityCss, '.richToolbar')).toMatch(/flex-wrap:\s*wrap/)
    const buttonRule = getRule(phoneOrCoarse, '.richToolbar button,\n  .gridActions button')

    expect(buttonRule).toMatch(/min-height:\s*40px/)
    expect(buttonRule).toMatch(/min-width:\s*40px/)
  })

  it('gives the section controls 44px targets', () => {
    const controlRule = getRule(phoneOrCoarse, '.sectionDragHandle,\n  .removeSectionButton,\n  .sectionMoveButton')

    expect(controlRule).toMatch(/width:\s*var\(--touch-target, 44px\)/)
    expect(controlRule).toMatch(/height:\s*var\(--touch-target, 44px\)/)
  })

  it('caps the icon search modal to the phone viewport above the sheet', () => {
    const modalRule = getRule(phone, '.iconModal,\n  .iconModalAbility')

    expect(modalRule).toMatch(/max-height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/)
    expect(modalRule).toMatch(/overflow-y:\s*auto/)
    expect(getRule(abilityCss, '.iconBackdrop')).toMatch(/z-index:\s*30000/)
    expect(getRule(phone, '.iconHeader')).toMatch(/position:\s*sticky/)
  })

  it('caps the boon icon picker and the scaling popover to the phone viewport', () => {
    const boonCss = readCss('components/panels/HeroStatsBoonPanel.module.css')
    const boonPhone = getMediaBlocks(boonCss, PHONE).join('\n')
    const pickerCss = readCss('components/panels/ScalingPicker.module.css')
    const pickerPhone = getMediaBlocks(pickerCss, PHONE).join('\n')

    expect(getRule(boonCss, '.iconPickerBackdrop')).toMatch(/z-index:\s*2200/)
    expect(getRule(boonPhone, '.iconPicker')).toMatch(/max-height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/)
    expect(getRule(boonPhone, '.iconPicker')).toMatch(/overflow-y:\s*auto/)
    expect(getRule(pickerPhone, '.menu')).toMatch(/width:\s*min\(252px,\s*calc\(100vw - 16px\)\)/)
    expect(getRule(pickerPhone, '.menu')).toMatch(/max-height:/)
    expect(getRule(pickerCss, '.menu')).toMatch(/z-index:\s*10001/)
  })

  it('makes panel cells 40px tall and widens fixed-width numeric inputs on touch', () => {
    for (const path of ['components/panels/HeroStatsSpiritPanel.module.css', 'components/panels/HeroStatsVitalityPanel.module.css']) {
      const block = getMediaBlocks(readCss(path), PHONE_OR_COARSE).join('\n')

      expect(getRule(block, '.cell')).toMatch(/min-height:\s*40px/)
    }

    const weaponBlock = getMediaBlocks(readCss('components/panels/WeaponPanel.module.css'), PHONE_OR_COARSE).join('\n')
    const valueBlock = getMediaBlocks(readCss('components/panels/ScalingValueEditor.module.css'), PHONE_OR_COARSE).join('\n')

    expect(getRule(weaponBlock, '.statCell')).toMatch(/min-height:\s*40px/)
    expect(getRule(weaponBlock, '.falloffInput')).toMatch(/width:\s*44px/)
    expect(getRule(valueBlock, '.input')).toMatch(/width:\s*64px/)
  })
})

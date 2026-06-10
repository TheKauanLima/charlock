// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

describe('AbilityEditor', () => {
  it('manages focused ability state and saves a scaled rich-text payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Kinetic Fault')

    const rangeStatBox = screen.getByTestId('ability-stat-sub-range')

    expect(rangeStatBox).toHaveAttribute('data-scaling', 'none')
    await user.click(rangeStatBox)
    expect(rangeStatBox).toHaveAttribute('data-scaling', 'spirit')
    await user.clear(within(rangeStatBox).getByLabelText('spirit scaling value'))
    await user.type(within(rangeStatBox).getByLabelText('spirit scaling value'), '1.25')

    await user.click(screen.getByLabelText('Charges'))
    expect(screen.getByLabelText('Choose Recharge Time icon')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Add sub-header stat'))
    expect(screen.getByRole('button', { name: 'Remove Stat' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Stat' }))
    expect(screen.queryByRole('button', { name: 'Remove Stat' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Add sub-header stat'))

    await user.click(screen.getByRole('button', { name: 'Grid' }))
    expect(screen.getByRole('button', { name: 'Remove Stats section' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Stats section' }))
    expect(screen.queryByRole('button', { name: 'Remove Stats section' })).not.toBeInTheDocument()

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    expect(richTextEditor).toHaveTextContent('Abrams channels custom ability 1.')
    expect(richTextEditor).not.toHaveTextContent('[b]')

    const firstTextNode = richTextEditor.firstChild

    expect(firstTextNode).not.toBeNull()

    const range = document.createRange()
    range.setStart(firstTextNode!, 0)
    range.setEnd(firstTextNode!, 6)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Bold selected text' }))
    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Healing color' }))
    await user.click(screen.getByRole('button', { name: 'Inline Icon' }))

    const iconModal = screen.getByTestId('property-icon-modal')

    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Kinetic Fault',
      hasCharges: true,
      subStats: expect.arrayContaining([
        expect.objectContaining({
          label: 'Range',
          scaling: 'spirit',
          scalingValue: '1.25',
        }),
        expect.objectContaining({
          label: 'Stat',
        }),
      ]),
    }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('[b]')
    expect(savedRichText?.text).toContain('[c:healing]')
    expect(savedRichText?.text).toContain('[i:heal]')
    expect(savedRichText?.text.indexOf('[i:heal]')).toBeLessThan(savedRichText?.text.indexOf(' channels') ?? 0)
  })

  it('does not duplicate inline icons when styling a selection that contains one', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Before [i:heal] after.',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).not.toBeNull()
    })

    const inlineIcon = richTextEditor.querySelector('[data-inline-icon="heal"]')

    expect(inlineIcon).not.toBeNull()

    const range = document.createRange()
    range.setStartBefore(inlineIcon!)
    range.setEndAfter(inlineIcon!)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Darken selected text' }))
    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')
    const iconTokens = savedRichText?.text.match(/\[i:heal\]/g) ?? []

    expect(iconTokens).toHaveLength(1)
    expect(savedRichText?.text).toContain('[dark][i:heal][/dark]')
  })

  it('toggles rich text effects off when the whole selection already has them', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })
    const firstTextNode = richTextEditor.firstChild

    expect(firstTextNode).not.toBeNull()

    const range = document.createRange()
    range.setStart(firstTextNode!, 0)
    range.setEnd(firstTextNode!, 6)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Bold selected text' }))
    await user.click(screen.getByRole('button', { name: 'Bold selected text' }))
    await user.click(screen.getByRole('button', { name: 'Italicize selected text' }))
    await user.click(screen.getByRole('button', { name: 'Italicize selected text' }))
    await user.click(screen.getByRole('button', { name: 'Darken selected text' }))
    await user.click(screen.getByRole('button', { name: 'Darken selected text' }))
    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Healing color' }))
    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Healing color' }))

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('Abrams channels custom ability 1.')
    expect(savedRichText?.text).not.toContain('[b]Abrams')
    expect(savedRichText?.text).not.toContain('[i]Abrams')
    expect(savedRichText?.text).not.toContain('[dark]Abrams')
    expect(savedRichText?.text).not.toContain('[c:healing]Abrams')
  })

  it('extends an effect when only part of the selection already has it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: '[b]Abrams[/b] channels custom ability 1.',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('strong')).not.toBeNull()
    })

    const boldElement = richTextEditor.querySelector('strong')
    const plainTextNode = boldElement?.nextSibling

    expect(boldElement).not.toBeNull()
    expect(plainTextNode).not.toBeNull()

    const range = document.createRange()
    range.setStartBefore(boldElement!)
    range.setEnd(plainTextNode!, ' channels'.length)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Bold selected text' }))
    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toMatch(/\[b\][\s\S]*channels\[\/b\]/)
  })

  it('partitions main grid cells across the full grid width with editable top labels', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = ability.sections.filter(section => section.type === 'richText')

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Grid' }))

    expect(screen.queryByLabelText('Grid Section Title')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Main cell 1 title')).toHaveValue('Damage')
    const firstMainStat = screen.getByTestId('ability-stat-main-damage')

    expect(within(firstMainStat).getByPlaceholderText('Detail')).toBeVisible()
    await user.clear(within(firstMainStat).getByLabelText('Value'))
    await user.type(within(firstMainStat).getByLabelText('Value'), 'Impact Text')
    await user.type(within(firstMainStat).getByLabelText('Append'), 'm')
    await user.type(within(firstMainStat).getByPlaceholderText('Detail'), 'Radius')

    const mainCellGrid = screen.getByLabelText('Main cell 1 title').closest('[class*="mainCellGrid"]') as HTMLElement | null

    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove main cell 3' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeEnabled()

    await user.clear(screen.getByLabelText('Main cell 1 title'))
    await user.type(screen.getByLabelText('Main cell 1 title'), 'Impact Damage')
    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedGrid = savedAbility?.sections.find(section => section.type === 'grid')

    expect(savedGrid).toEqual(expect.objectContaining({
      title: 'Stats',
      mainCells: expect.arrayContaining([
        expect.objectContaining({
          label: 'Impact Damage',
          value: 'Impact Text',
          append: 'm',
          unit: 'Radius',
        }),
      ]),
    }))
    expect(savedGrid?.mainCells).toHaveLength(2)
  })

  it('adds lower stats into a single full-width two-column stat band', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = ability.sections.filter(section => section.type === 'richText')

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Grid' }))
    await user.click(screen.getByRole('button', { name: 'Add Lower Cell' }))
    await user.click(screen.getByRole('button', { name: 'Add Lower Cell' }))
    await user.click(screen.getByRole('button', { name: 'Add Lower Cell' }))

    const lowerCellGrid = screen.getByTestId('lower-cell-grid')

    expect(lowerCellGrid).toBeInTheDocument()
    expect(lowerCellGrid.children).toHaveLength(3)
    expect(screen.getAllByTestId('ability-stat-lower-detail')).toHaveLength(3)

    const firstLowerStat = screen.getAllByTestId('ability-stat-lower-detail')[0]

    await user.clear(within(firstLowerStat).getByLabelText('Value'))
    await user.type(within(firstLowerStat).getByLabelText('Value'), '15')
    await user.type(within(firstLowerStat).getByLabelText('Append'), '%')
    await user.clear(within(firstLowerStat).getByLabelText('Detail'))
    await user.type(within(firstLowerStat).getByLabelText('Detail'), 'Bonus')
    await user.click(firstLowerStat)
    expect(firstLowerStat).toHaveAttribute('data-scaling', 'spirit')
    expect(lowerCellGrid.querySelectorAll('[class*="inlineStatEditorScaled"]')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Remove lower cell 3' }))
    expect(lowerCellGrid.children).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedGrid = savedAbility?.sections.find(section => section.type === 'grid')

    expect(savedGrid?.lowerCells).toHaveLength(2)
    expect(savedGrid?.lowerCells[0]).toEqual(expect.objectContaining({
      label: 'Bonus',
      value: '15',
      append: '%',
      scaling: 'spirit',
    }))
  })

  it('keeps intrinsic-color inline icons from being tinted by rich text colors', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Before [i:damage_bullet_color] after.',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon="damage_bullet_color"]')).not.toBeNull()
    })

    const coloredIcon = richTextEditor.querySelector<HTMLElement>('[data-inline-icon="damage_bullet_color"]')

    expect(coloredIcon?.style.backgroundImage).toContain('damage_bullet_color.svg')
    expect(coloredIcon?.style.maskImage).toBe('')

    const range = document.createRange()
    range.setStartBefore(coloredIcon!)
    range.setEndAfter(coloredIcon!)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Healing color' }))

    const recoloredIcon = richTextEditor.querySelector<HTMLElement>('[data-inline-icon="damage_bullet_color"]')

    expect(recoloredIcon?.style.backgroundImage).toContain('damage_bullet_color.svg')
    expect(recoloredIcon?.style.maskImage).toBe('')

    await user.click(screen.getByRole('button', { name: 'Inline Icon' }))

    const iconModal = screen.getByTestId('property-icon-modal')

    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'damage bullet')

    const coloredIconOption = within(iconModal).getByRole('button', { name: 'Use Damage Bullet' })
    const coloredIconPreview = coloredIconOption.querySelector<HTMLElement>('span')

    expect(coloredIconPreview?.style.backgroundImage).toContain('damage_bullet_color.svg')
    expect(coloredIconPreview?.style.maskImage).toBe('')
  })

  it('applies selected icon swatch colors to tintable inline icons', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })
    const firstTextNode = richTextEditor.firstChild
    const range = document.createRange()

    expect(firstTextNode).not.toBeNull()
    range.setStart(firstTextNode!, 6)
    range.collapse(true)
    richTextEditor.focus()
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Inline Icon' }))

    const iconModal = screen.getByTestId('property-icon-modal')

    await user.click(within(iconModal).getByRole('button', { name: 'Green icon color' }))
    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')

    const healOption = within(iconModal).getByRole('button', { name: 'Use Heal' })
    const healPreview = healOption.querySelector<HTMLElement>('span')

    expect(healPreview?.style.backgroundColor).toBe('rgb(46, 152, 96)')

    await user.click(healOption)
    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('[i:heal|#2e9860]')
  })

  it('persists selected icon swatch colors on tintable stat icons', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Choose Range icon'))

    const iconModal = screen.getByTestId('property-icon-modal')

    await user.click(within(iconModal).getByRole('button', { name: 'Violet icon color' }))
    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))
    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]

    expect(savedAbility?.subStats).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Range',
        icon: '/panorama/images/icons/properties/heal.svg',
        iconColor: '#594561',
      }),
    ]))
  })

  it('deletes inline icons with backspace when the caret is after one', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Before [i:heal] after.',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).not.toBeNull()
    })

    const inlineIcon = richTextEditor.querySelector('[data-inline-icon="heal"]')
    const range = document.createRange()

    expect(inlineIcon).not.toBeNull()
    range.setStartAfter(inlineIcon!)
    range.collapse(true)
    richTextEditor.focus()
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.keyboard('{Backspace}')

    expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[i:heal]')
  })

  it('deletes a final inline icon even when the editor has a trailing break', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Before [i:heal]',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).not.toBeNull()
    })

    richTextEditor.append(document.createElement('br'))

    const range = document.createRange()

    range.setStart(richTextEditor, richTextEditor.childNodes.length)
    range.collapse(true)
    richTextEditor.focus()
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.keyboard('{Backspace}')

    expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[i:heal]')
  })

  it('places the caret after a clicked final inline icon so backspace can remove it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Before [i:heal]',
    }]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).not.toBeNull()
    })

    const inlineIcon = richTextEditor.querySelector<HTMLElement>('[data-inline-icon="heal"]')

    expect(inlineIcon).not.toBeNull()

    await user.click(inlineIcon!)
    await user.keyboard('{Backspace}')

    expect(richTextEditor.querySelector('[data-inline-icon="heal"]')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[i:heal]')
  })

  it('removes pending inline icon placeholders when the icon picker is closed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })
    const firstTextNode = richTextEditor.firstChild
    const range = document.createRange()

    expect(firstTextNode).not.toBeNull()
    range.setStart(firstTextNode!, 6)
    range.collapse(true)
    richTextEditor.focus()
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Inline Icon' }))

    expect(richTextEditor.querySelector('[data-inline-icon-marker]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close property icon selector' }))

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon-marker]')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[[inline-icon-marker:')
  })
})

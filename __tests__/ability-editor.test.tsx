// @vitest-environment jsdom

import { readdirSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { ABILITY_ICON_GROUPS, PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

describe('AbilityEditor', () => {
  it('exposes every property icon asset in the icon picker groups', () => {
    const exportedPaths = PROPERTY_ICON_GROUPS.flatMap(group => group.assets.map(asset => asset.path)).sort()
    const exportedLabels = PROPERTY_ICON_GROUPS.flatMap(group => group.assets.map(asset => asset.label))
    const directoryPaths = readdirSync('public/panorama/images/icons/properties')
      .filter(fileName => fileName.endsWith('.svg'))
      .map(fileName => `/panorama/images/icons/properties/${fileName}`)
      .sort()

    expect(exportedPaths).toEqual(directoryPaths)
    expect(exportedLabels).toContain('Ammo Reload Auto')
    expect(exportedLabels).toContain('Damage Bullet Color')
  })

  it('shows the hero info cluster and changes ability circle icons from the focused editor', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onHeroInfoChange = vi.fn()
    const onAbilityIconChange = vi.fn()
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onHeroInfoChange={onHeroInfoChange}
        onAbilityIconChange={onAbilityIconChange}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Change Ability 1 icon' }))

    const iconModal = screen.getByTestId('ability-icon-modal')

    await user.click(within(iconModal).getByRole('button', { name: 'Use Abrams 2' }))

    expect(onHeroInfoChange).toHaveBeenCalledWith(expect.objectContaining({
      ability1Icon: hero.heroInfo.ability2Icon,
    }))
    expect(onAbilityIconChange).toHaveBeenCalledWith({ set: 'primary', index: 0 }, hero.heroInfo.ability2Icon)

    await user.click(screen.getByRole('button', { name: 'Go Back' }))
    expect(onSave.mock.calls[0]?.[0].icon).toBe(hero.heroInfo.ability2Icon)
  })

  it('marks the active ability and commits the draft when selecting another ability from the hero cluster', async () => {
    const user = userEvent.setup()
    const onAbilitySelect = vi.fn()
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onAbilitySelect={onAbilitySelect}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Change Ability 1 icon' })).toHaveAttribute('aria-pressed', 'true')

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Edited First Ability')
    await user.click(screen.getByRole('button', { name: 'Edit Ability 2' }))

    expect(onAbilitySelect).toHaveBeenCalledWith({ set: 'primary', index: 1 }, expect.objectContaining({
      name: 'Edited First Ability',
      slot: 1,
    }))
  })

  it('shows a focused second ability set toggle next to the hero info cluster', async () => {
    const user = userEvent.setup()
    const onSecondAbilitySetToggle = vi.fn()
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        isSecondAbilitySetEnabled={false}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onSecondAbilitySetToggle={onSecondAbilitySetToggle}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Toggle Commit Check')
    await user.click(screen.getByRole('button', { name: 'Secondary Abilities' }))

    expect(onSecondAbilitySetToggle).toHaveBeenCalledWith(true, expect.objectContaining({
      name: 'Toggle Commit Check',
      slot: 1,
    }))
  })

  it('exposes placeholders on editable ability text fields', () => {
    const hero = HEROES[0]
    const ability = structuredClone(buildDefaultAbilityStats(hero).abilities[0])
    const onSave = vi.fn()

    ability.tiers = ability.tiers.map(tier => ({
      ...tier,
      upgradeText: tier.tier === 2 ? 'N/A' : '',
    }))

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const tierOneText = screen.getByLabelText('Tier 1 upgrade text')
    const tierTwoText = screen.getByLabelText('Tier 2 upgrade text')
    const tierOneShell = tierOneText.parentElement

    expect(screen.getByLabelText('Ability Name')).toHaveAttribute('placeholder', 'Ability name')
    expect(screen.getByLabelText('Description rich text')).toHaveAttribute('data-placeholder', 'Write ability text...')
    expect(tierOneText).toHaveAttribute('data-placeholder', 'Tier 1 upgrade')
    expect(tierOneText).toHaveAttribute('data-empty', 'true')
    expect(tierOneShell?.className).toContain('tierTextShell')
    expect(tierTwoText).toHaveAttribute('data-placeholder', 'Tier 2 upgrade')
    expect(tierTwoText).toHaveAttribute('data-empty', 'true')
    expect(tierTwoText).not.toHaveTextContent('N/A')
    expect(screen.getByLabelText('Tier 3 upgrade text')).toHaveAttribute('data-placeholder', 'Tier 3 upgrade')
    expect(screen.getByLabelText('Main cell 1 title')).toHaveAttribute('placeholder', 'Detail')

    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedTierTwo = savedAbility?.tiers.find(tier => tier.tier === 2)

    expect(savedTierTwo?.upgradeText).toBe('')
  })

  it('renders preview tier text without editable boxes and shrinks long upgrades', () => {
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.tiers = ability.tiers.map(tier => ({
      ...tier,
      upgradeText: tier.tier === 1
        ? 'Take 35% less damage from Pain Cycle while the timer is active'
        : tier.upgradeText,
    }))

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        mode="preview"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const tierOneText = screen.getByRole('textbox', { name: 'Tier 1 upgrade text' })
    const tierTextShell = tierOneText.parentElement

    expect(tierOneText.className).toContain('tierTextEditorReadOnly')
    expect(tierOneText.className).toContain('tierTextEditorCompact')
    expect(tierTextShell?.className).toContain('tierTextShellReadOnly')
    expect(tierOneText).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByRole('button', { name: 'Bold Tier 1 selected text' })).not.toBeInTheDocument()
  })

  it('renders preview grid cells without empty detail titles and exposes scaling values', () => {
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [
      {
        id: 'preview-grid',
        type: 'grid',
        title: 'Stats',
        mainCells: [
          {
            ...ability.cooldown,
            id: 'preview-main-cell',
            label: 'Damage',
            value: '12',
            unit: 'Missing Health as Damage',
            append: '+very-long-append',
            scaling: 'spirit',
            scalingValue: '0.15',
          },
        ],
        lowerCells: [
          {
            ...ability.cooldown,
            id: 'preview-lower-cell',
            label: 'Very Long Lower Stat Label',
            value: '203',
            unit: '',
            append: 'm/s',
            scaling: 'none',
            scalingValue: '0',
          },
        ],
      },
    ]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        mode="preview"
        showDetails
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const mainStat = screen.getByTestId('ability-stat-main-damage')
    const lowerStat = screen.getByTestId('ability-stat-lower-very-long-lower-stat-label')
    const mainCell = mainStat.closest('[class*="mainCell"]')
    const mainRow = mainStat.querySelector('[class*="mainRow"]')

    expect(screen.queryByLabelText('Main cell 1 title')).not.toBeInTheDocument()
    expect(mainCell?.querySelector('[class*="mainCellTitleSpacer"]')).toBeInTheDocument()
    expect(mainRow).toBeInTheDocument()
    expect(within(mainStat).getByLabelText('spirit scaling value x0.15')).toBeInTheDocument()
    expect(within(mainStat).getByText('Missing Health as Damage').className).toContain('readonlyStatText')
    expect(within(mainStat).getByText('+very-long-append').className).toContain('readonlyStatText')
    expect(within(mainStat).getByText('+very-long-append').className).toContain('readonlyStatTextNoWrap')
    expect(within(mainStat).getByText('Missing Health as Damage').className).not.toContain('readonlyStatTextNoWrap')
    expect(within(lowerStat).getByText('Very Long Lower Stat Label').className).toContain('readonlyStatText')
  })

  it('keeps tier box line breaks in one vertical text flow', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))

    const tierOneText = screen.getByRole('textbox', { name: 'Tier 1 upgrade text' })

    tierOneText.innerHTML = '<div>Line one</div><div>Line two</div>'
    fireEvent.input(tierOneText)
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedTierOne = savedAbility?.tiers.find(tier => tier.tier === 1)

    expect(savedTierOne?.upgradeText).toBe('Line one\nLine two')
  })

  it('manages focused ability state and saves a scaled rich-text payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.tiers = ability.tiers.map(tier => ({
      ...tier,
      variant: {
        ...tier.variant,
        name: `Stale Tier ${tier.tier} Name`,
      },
    }))

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()
    expect(screen.getByLabelText('Cooldown')).toBeChecked()
    expect(screen.getByTestId('ability-stat-timing-cooldown')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Cooldown'))
    expect(screen.queryByTestId('ability-stat-timing-cooldown')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Kinetic Fault')

    const rangeStatBox = screen.getByTestId('ability-stat-sub-range')

    expect(rangeStatBox).toHaveAttribute('data-scaling', 'none')
    await user.click(within(rangeStatBox).getByRole('button', { name: 'Edit Range scaling' }))
    expect(screen.getByRole('dialog', { name: 'Range scaling controls' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set Range scaling to spirit' }))
    expect(rangeStatBox).toHaveAttribute('data-scaling', 'spirit')
    await user.clear(within(rangeStatBox).getByLabelText('Range scaling value'))
    await user.type(within(rangeStatBox).getByLabelText('Range scaling value'), '1.25')

    await user.click(screen.getByLabelText('Charges'))
    expect(screen.getByLabelText('Choose Recharge Time icon')).toBeInTheDocument()
    await user.click(within(screen.getByTestId('ability-stat-timing-charges')).getByRole('button', { name: 'Edit Charges scaling' }))
    expect(screen.getByRole('dialog', { name: 'Charges scaling controls' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Range scaling controls' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Ability Name'))
    expect(screen.queryByRole('dialog', { name: 'Charges scaling controls' })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Add sub-header stat'))
    expect(screen.getByRole('button', { name: 'Remove Stat' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Stat' }))
    expect(screen.queryByRole('button', { name: 'Remove Stat' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Add sub-header stat'))
    expect(within(screen.getByTestId('ability-stat-sub-stat')).getByLabelText('Unit')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Grid' }))
    expect(screen.getByRole('button', { name: 'Remove Stats section' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Stats section' }))
    expect(screen.queryByRole('button', { name: 'Remove Stats section' })).not.toBeInTheDocument()

    const richTextEditor = screen.getByRole('textbox', { name: 'Description rich text' })

    expect(screen.queryByDisplayValue('Description')).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Kinetic Fault',
      hasCooldown: false,
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

  it('keeps ability names unified while tier-specific upgrade text stays isolated', async () => {
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

    const tierOneButton = screen.getByRole('button', { name: 'Tier 1 upgrade' })
    const tierTwoButton = screen.getByRole('button', { name: 'Tier 2 upgrade' })

    expect(screen.getByRole('button', { name: '0' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(tierOneButton)
    expect(tierOneButton.className).toContain('tierBoxFlashing')
    await user.click(tierTwoButton)
    expect(tierOneButton.className).toContain('tierBoxActive')
    expect(tierTwoButton.className).toContain('tierBoxFlashing')
    await user.click(tierOneButton)
    expect(screen.getByLabelText('Ability Name')).toHaveValue('Abrams Ability 1')

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Unified Ability Name')

    const tierOneText = screen.getByRole('textbox', { name: 'Tier 1 upgrade text' })

    tierOneText.textContent = 'Tier one'
    fireEvent.input(tierOneText)
    tierOneText.focus()

    const tierTextNode = tierOneText.firstChild

    expect(tierTextNode).not.toBeNull()

    const caretRange = document.createRange()

    caretRange.setStart(tierTextNode!, 'Tier one'.length)
    caretRange.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(caretRange)

    await user.keyboard(' upgrade')
    expect(tierOneText.textContent).toContain('Tier one upgrade')

    const boldRange = document.createRange()
    const updatedTierTextNode = tierOneText.firstChild

    expect(updatedTierTextNode).not.toBeNull()
    boldRange.setStart(updatedTierTextNode!, 'Tier one '.length)
    boldRange.setEnd(updatedTierTextNode!, 'Tier one upgrade'.length)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(boldRange)

    const tierBoldButton = screen.getByRole('button', { name: 'Bold Tier 1 selected text' })

    await user.click(tierBoldButton)
    expect(tierOneText.querySelector('strong')?.textContent).toBe('upgrade')

    await user.click(tierBoldButton)
    expect(tierOneText.querySelector('strong')).toBeNull()

    await user.click(screen.getByRole('button', { name: '0' }))
    expect(screen.getByLabelText('Ability Name')).toHaveValue('Unified Ability Name')

    await user.click(tierOneButton)
    expect(screen.getByLabelText('Ability Name')).toHaveValue('Unified Ability Name')

    await user.click(tierTwoButton)
    expect(screen.getByLabelText('Ability Name')).toHaveValue('Unified Ability Name')

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedTierOne = savedAbility?.tiers.find(tier => tier.tier === 1)
    const savedTierTwo = savedAbility?.tiers.find(tier => tier.tier === 2)

    expect(savedAbility?.name).toBe('Unified Ability Name')
    expect(savedAbility?.tiers).toHaveLength(3)
    expect(savedTierOne?.upgradeText).toBe('Tier one upgrade')
    expect(savedTierOne?.variant.name).toBe('Unified Ability Name')
    expect(savedTierTwo?.variant.name).toBe('Unified Ability Name')
  })

  it('cascades stat edits from lower tiers into higher tiers', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    async function setCooldown(value: string) {
      const cooldown = screen.getByTestId('ability-stat-timing-cooldown')
      const valueInput = within(cooldown).getByLabelText('Value')

      await user.clear(valueInput)
      await user.type(valueInput, value)
    }

    function expectCooldown(value: string) {
      const cooldown = screen.getByTestId('ability-stat-timing-cooldown')

      expect(within(cooldown).getByLabelText('Value')).toHaveValue(value)
    }

    await setCooldown('31')
    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))
    expectCooldown('31')

    await setCooldown('41')
    await user.click(screen.getByRole('button', { name: 'Tier 2 upgrade' }))
    expectCooldown('41')

    await setCooldown('51')
    await user.click(screen.getByRole('button', { name: 'Tier 3 upgrade' }))
    expectCooldown('51')

    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))
    expectCooldown('41')

    await user.click(screen.getByRole('button', { name: '0' }))
    expectCooldown('31')
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
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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
    await user.click(screen.getByRole('button', { name: 'Apply Default color' }))

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('Abrams channels custom ability 1.')
    expect(savedRichText?.text).not.toContain('[b]Abrams')
    expect(savedRichText?.text).not.toContain('[i]Abrams')
    expect(savedRichText?.text).not.toContain('[dark]Abrams')
    expect(savedRichText?.text).not.toContain('[c:healing]Abrams')
  })

  it('closes text swatches on outside click and exposes the expanded palette', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))

    expect(screen.getByRole('button', { name: 'Apply Default color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply Green color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply Orange color' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Apply Orange color' })).not.toBeInTheDocument()
    })
  })

  it('replaces rich text colors instead of stacking them and clears them with Default', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: '[c:green]Abrams[/c] channels custom ability 1.',
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
      expect(richTextEditor.querySelector('[data-rich-color="green"]')).not.toBeNull()
    })

    const greenText = richTextEditor.querySelector('[data-rich-color="green"]')
    const range = document.createRange()

    expect(greenText).not.toBeNull()
    range.selectNodeContents(greenText!)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Orange color' }))

    expect(richTextEditor.querySelector('[data-rich-color="green"]')).toBeNull()
    expect(richTextEditor.querySelector('[data-rich-color="orange"]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    await user.click(screen.getByRole('button', { name: 'Apply Default color' }))
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('Abrams channels custom ability 1.')
    expect(savedRichText?.text).not.toContain('[c:green]')
    expect(savedRichText?.text).not.toContain('[c:orange]')
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
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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
    expect(screen.getByLabelText('Main cell 1 title')).toHaveValue('')
    expect(screen.queryByDisplayValue('Damage')).not.toBeInTheDocument()
    const firstMainStat = screen.getByTestId('ability-stat-main-damage')
    const mainDetailInput = within(firstMainStat).getByPlaceholderText('Detail')

    expect(mainDetailInput).toBeVisible()
    expect(mainDetailInput).toHaveStyle({ width: '6ch' })
    await user.clear(within(firstMainStat).getByLabelText('Value'))
    await user.type(within(firstMainStat).getByLabelText('Value'), 'Impact Text')
    expect(within(firstMainStat).getByLabelText('Value')).toHaveValue('ImpactText')
    await user.type(within(firstMainStat).getByLabelText('Append'), 'm')
    await user.type(mainDetailInput, 'Radius')

    const mainCellGrid = screen.getByLabelText('Main cell 1 title').closest('[class*="mainCellGrid"]') as HTMLElement | null

    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(1, minmax(min-content, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(min-content, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(3, minmax(min-content, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove main cell 3' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(min-content, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeEnabled()

    await user.clear(screen.getByLabelText('Main cell 1 title'))
    await user.type(screen.getByLabelText('Main cell 1 title'), 'Impact Damage')
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedGrid = savedAbility?.sections.find(section => section.type === 'grid')

    expect(savedGrid).toEqual(expect.objectContaining({
      title: 'Stats',
      mainCells: expect.arrayContaining([
        expect.objectContaining({
          label: 'Impact Damage',
          value: 'ImpactText',
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
    await user.click(within(firstLowerStat).getByRole('button', { name: 'Edit Bonus scaling' }))
    await user.click(screen.getByRole('button', { name: 'Set Bonus scaling to spirit' }))
    expect(firstLowerStat).toHaveAttribute('data-scaling', 'spirit')
    expect(lowerCellGrid.querySelectorAll('[class*="inlineStatEditorScaled"]')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Remove lower cell 3' }))
    expect(lowerCellGrid.children).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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

    const coloredIconOption = within(iconModal).getByRole('button', { name: 'Use Damage Bullet Color' })
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

    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')

    const healOption = within(iconModal).getByRole('button', { name: 'Use Heal' })
    const healPreview = healOption.querySelector<HTMLElement>('span')

    expect(healPreview?.style.backgroundColor).toBe('rgb(255, 255, 255)')

    await user.click(within(iconModal).getByRole('button', { name: 'Green icon color' }))

    expect(healPreview?.style.backgroundColor).toBe('rgb(46, 152, 96)')

    await user.click(within(iconModal).getByRole('button', { name: 'Fresh Green icon color' }))

    expect(healPreview?.style.backgroundColor).toBe('rgb(132, 201, 85)')

    await user.click(healOption)
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('[i:heal|#84c955]')
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
    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

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

    fireEvent.pointerDown(screen.getByTestId('property-icon-modal'))

    await waitFor(() => {
      expect(richTextEditor.querySelector('[data-inline-icon-marker]')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[[inline-icon-marker:')
  })
})

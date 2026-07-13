// @vitest-environment jsdom

import { readFileSync, readdirSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import { buildDefaultAbilityStats, normalizeAbilityStats } from '@/lib/ability-editor-types'
import { ABILITY_ICON_GROUPS, PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

async function confirmFocusedGoBack(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Go Back' }))
}

function findTextNodeContaining(root: Node, text: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode()

  while (currentNode) {
    if (currentNode.textContent?.includes(text)) {
      return currentNode
    }

    currentNode = walker.nextNode()
  }

  throw new Error(`Unable to find text node containing "${text}"`)
}

describe('AbilityEditor', () => {
  it('uses the cast property art for default charge stats', () => {
    const abilities = buildDefaultAbilityStats(HEROES[0]).abilities

    expect(abilities.every(ability => ability.charges.icon === '/panorama/images/upgrades/property_cast_psd.png')).toBe(true)
    expect(abilities.every(ability => ability.tiers.every(tier => tier.variant.charges.icon === '/panorama/images/upgrades/property_cast_psd.png'))).toBe(true)

    const legacy = {
      ...buildDefaultAbilityStats(HEROES[0]),
      abilities: abilities.map(ability => ({
        ...ability,
        charges: { ...ability.charges, icon: '/panorama/images/icons/properties/charge.svg' },
      })),
    }
    const normalized = normalizeAbilityStats(legacy, HEROES[0])

    expect(normalized.abilities.every(ability => ability.charges.icon === '/panorama/images/upgrades/property_cast_psd.png')).toBe(true)
  })

  it('uses the shared ability-circle gap and places pair swap controls below both circles', () => {
    const sharedStyles = readFileSync('components/HeroAbilityIconRow/HeroAbilityIconRow.module.css', 'utf8')
    const editorStyles = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const heroInfoEditorStyles = readFileSync('components/HeroInfoEditor/HeroInfoEditor.module.css', 'utf8')
    const sharedRowRule = sharedStyles.match(/\.row\s*\{([^}]*)\}/)?.[1]
    const sharedWrapRule = sharedStyles.match(/\.wrap\s*\{([^}]*)\}/)?.[1]
    const swapRule = sharedStyles.match(/\.swapAbility\s*\{([^}]*)\}/)?.[1]
    const focusedOverride = editorStyles.match(/\.heroInfoAbilities\s*\{([^}]*)\}/)?.[1]
    const mainOverride = heroInfoEditorStyles.match(/\.abilitiesRow\s*\{([^}]*)\}/)?.[1]

    expect(sharedRowRule).toMatch(/gap:\s*[^;]+;/)
    expect(sharedRowRule).toMatch(/align-items:\s*flex-start/)
    expect(sharedWrapRule).toMatch(/height:\s*clamp\(54px, 4\.5vw, 75px\)/)
    expect(focusedOverride).not.toMatch(/gap:/)
    expect(mainOverride).not.toMatch(/gap:/)
    expect(swapRule).toMatch(/top:\s*calc\(114% \+ 7px\)/)
    expect(swapRule).toMatch(/left:\s*57%/)
  })

  it('keeps the tooltip and tiers in one vertical scroll container', () => {
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const mainColumnRule = stylesheet.match(/\.mainEditorColumn\s*\{([^}]*)\}/)?.[1]
    const tierSystemRule = stylesheet.match(/\.tierSystem\s*\{([^}]*)\}/)?.[1]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const scrollContainer = screen.getByTestId('ability-editor-scroll-container')
    const tiers = screen.getByRole('region', { name: 'Ability tiers' })

    expect(scrollContainer).toContainElement(tiers)
    expect(mainColumnRule).toMatch(/overflow-y:\s*auto/)
    expect(tierSystemRule).toMatch(/overflow-x:\s*clip/)
    expect(tierSystemRule).toMatch(/overflow-y:\s*visible/)
  })

  it('reduces the ability name font size after fifteen characters', () => {
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const longNameRule = stylesheet.match(/\.nameInputWrap input\.nameInputLong\s*\{([^}]*)\}/)?.[1]
    const { rerender } = render(
      <AbilityEditor
        key="short-name"
        ability={{ ...ability, name: '123456789012345' }}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Ability Name').className).not.toContain('nameInputLong')
    expect(longNameRule).toMatch(/font-size:\s*1\.55rem/)

    rerender(
      <AbilityEditor
        key="long-name"
        ability={{ ...ability, name: '1234567890123456' }}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Ability Name').className).toContain('nameInputLong')
  })

  it('centers the focused editor stage around the hero info cluster', () => {
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const editorLayoutRule = stylesheet.match(/^\.editorLayout\s*\{([^}]*)\}/m)?.[1]
    const heroClusterRule = stylesheet.match(/^\.heroInfoCluster\s*\{([^}]*)\}/m)?.[1]
    const secondSlotsRule = stylesheet.match(/^\.secondAbilityToggle\s*\{([^}]*)\}/m)?.[1]
    const editorLayoutPreviewRule = stylesheet.match(/^\.editorLayoutPreview\s*\{([^}]*)\}/m)?.[1]

    expect(editorLayoutRule).toMatch(/top:\s*50%/)
    expect(editorLayoutRule).toMatch(/left:\s*calc\(50% \+ clamp\(54px, 6vw, 120px\)\)/)
    expect(editorLayoutRule).toMatch(/transform:\s*translateY\(-50%\)/)
    expect(editorLayoutRule).not.toMatch(/top:\s*clamp\(88px, 10vh, 128px\)/)
    expect(editorLayoutRule).not.toMatch(/right:\s*clamp\(44px, 11vw, 210px\)/)
    expect(editorLayoutPreviewRule).toMatch(/transform:\s*none/)
    expect(heroClusterRule).toMatch(/left:\s*calc\(50% - clamp\(190px, 12\.5vw, 250px\)\)/)
    expect(heroClusterRule).toMatch(/width:\s*min\(42vw, 620px\)/)
    expect(heroClusterRule).toMatch(/transform:\s*translateX\(-50%\)/)
    expect(secondSlotsRule).toMatch(/left:\s*calc\(50% - clamp\(420px, 25vw, 500px\)\)/)
  })

  it('keeps focused ability navigation on the normal return panel', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const onSave = vi.fn()
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    expect(stylesheet).not.toContain('.editorSideRail')
    expect(stylesheet).not.toContain('.editorProfileButton')
    expect(screen.queryByRole('link', { name: 'Open profile' })).not.toBeInTheDocument()
    expect(screen.getByText('Focused Ability Editor')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go Back' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: ability.name }))
  })

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

    await confirmFocusedGoBack(user)
    expect(onSave.mock.calls[0]?.[0].icon).toBe(hero.heroInfo.ability2Icon)
  })

  it('offers every stat icon in a separate ability icon picker tab', async () => {
    const user = userEvent.setup()
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
        onHeroInfoChange={vi.fn()}
        onAbilityIconChange={onAbilityIconChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Change Ability 1 icon' }))

    const iconModal = screen.getByTestId('ability-icon-modal')
    const heroAbilitiesTab = within(iconModal).getByRole('tab', { name: 'Hero abilities' })
    const statIconsTab = within(iconModal).getByRole('tab', { name: 'Stat icons' })

    expect(heroAbilitiesTab).toHaveAttribute('aria-selected', 'true')
    expect(within(iconModal).queryByRole('button', { name: 'Use Heal' })).not.toBeInTheDocument()

    await user.click(statIconsTab)

    expect(statIconsTab).toHaveAttribute('aria-selected', 'true')
    expect(within(iconModal).getAllByRole('button', { name: /^Use / })).toHaveLength(
      PROPERTY_ICON_GROUPS.flatMap(group => group.assets).length + 1,
    )

    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))

    expect(onAbilityIconChange).toHaveBeenCalledWith(
      { set: 'primary', index: 0 },
      '/panorama/images/icons/properties/heal.svg',
    )
  })

  it('offers upgrade and mod icons in the ability icon picker', async () => {
    const user = userEvent.setup()
    const onAbilityIconChange = vi.fn()
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]
    const abilityIconPaths = ABILITY_ICON_GROUPS.flatMap(group => group.icons)

    expect(abilityIconPaths).toContain('/panorama/images/upgrades/property_cast_psd.png')
    expect(abilityIconPaths).toContain('/panorama/images/upgrades/mods_armor/advanced_armor_psd.png')
    expect(abilityIconPaths).toContain('/panorama/images/upgrades/mods_tech/quantum_chimaera_psd.png')
    expect(abilityIconPaths).toContain('/panorama/images/upgrades/mods_utility/zipline_mastery_psd.png')
    expect(abilityIconPaths).toContain('/panorama/images/upgrades/mods_weapon/warp_stone_psd.png')
    expect(abilityIconPaths).toContain('/panorama/images/hud/abilities/werewolf/5.png')
    expect(abilityIconPaths).toContain('/panorama/images/hud/abilities/werewolf/6.png')
    expect(abilityIconPaths).toContain('/panorama/images/hud/abilities/werewolf/7.png')

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onHeroInfoChange={vi.fn()}
        onAbilityIconChange={onAbilityIconChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Change Ability 1 icon' }))

    const iconModal = screen.getByTestId('ability-icon-modal')

    expect(within(iconModal).getByRole('tab', { name: 'Hero abilities' })).toHaveAttribute('aria-selected', 'true')
    const silverGroup = within(iconModal).getByRole('group', { name: 'Silver' })
    expect(within(silverGroup).getByRole('button', { name: 'Use Silver 5' })).toBeInTheDocument()
    expect(within(silverGroup).getByRole('button', { name: 'Use Silver 6' })).toBeInTheDocument()
    expect(within(silverGroup).getByRole('button', { name: 'Use Silver 7' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('tab', { name: 'Upgrade Icons' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('tab', { name: 'Armor Mods' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('tab', { name: 'Tech Mods' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('tab', { name: 'Utility Mods' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('tab', { name: 'Weapon Mods' })).toBeInTheDocument()
    expect(within(iconModal).queryByRole('group', { name: 'Weapon Mods' })).not.toBeInTheDocument()

    await user.click(within(iconModal).getByRole('tab', { name: 'Upgrade Icons' }))
    expect(within(iconModal).getByRole('button', { name: 'Use Upgrade Active' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('button', { name: 'Use Square Icon' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('button', { name: 'Medium square icon size' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(iconModal).getByRole('button', { name: 'Large square icon size' }))
    expect(within(iconModal).getByRole('button', { name: 'Large square icon size' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(iconModal).getByRole('tab', { name: 'Weapon Mods' }))
    expect(within(iconModal).getByRole('group', { name: 'Weapon Mods' })).toBeInTheDocument()
    await user.type(within(iconModal).getByPlaceholderText('Search ability icons'), 'warp stone')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Warp Stone' }))

    expect(onAbilityIconChange).toHaveBeenCalledWith(
      { set: 'primary', index: 0 },
      '/panorama/images/upgrades/mods_weapon/warp_stone_psd.png',
    )
  })

  it('saves the sized square icon from the ability icon picker', async () => {
    const user = userEvent.setup()
    const onAbilityIconChange = vi.fn()
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]

    const view = render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={hero.heroInfo}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onHeroInfoChange={vi.fn()}
        onAbilityIconChange={onAbilityIconChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Change Ability 1 icon' }))

    const iconModal = screen.getByTestId('ability-icon-modal')
    await user.click(within(iconModal).getByRole('button', { name: 'Tiny square icon size' }))
    await user.click(within(iconModal).getByRole('button', { name: 'Use Square Icon' }))

    expect(onAbilityIconChange).toHaveBeenCalledWith(
      { set: 'primary', index: 0 },
      'square:tiny',
    )

    view.rerender(
      <AbilityEditor
        ability={{ ...ability, icon: 'square:tiny' }}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={{ ...hero.heroInfo, ability1Icon: 'square:tiny' }}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onHeroInfoChange={vi.fn()}
        onAbilityIconChange={onAbilityIconChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const renderedSquare = screen.getByTestId('ability-editor-hero-info-ability-1').querySelector('[aria-hidden="true"]')
    expect(renderedSquare).toHaveAttribute('style', expect.stringContaining('width: 34%'))
    expect(renderedSquare).toHaveAttribute('style', expect.stringContaining('mask-image: none'))
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

  it('keeps editor preview geometry and carries hero typography into its hero cluster', () => {
    const hero = HEROES[0]
    const ability = buildDefaultAbilityStats(hero).abilities[0]
    const heroInfo = {
      ...hero.heroInfo,
      nameType: 'text' as const,
      nameValue: 'Mixed Name',
      nameFontSize: '3.8rem',
      nameFontFamily: 'Georgia, serif',
      nameFontWeight: '600',
      tag1Text: 'Mixed case tag',
    }
    const editorStylesheet = readFileSync('components/HeroInfoEditor/HeroInfoEditor.module.css', 'utf8')
    const tagSizingRule = editorStylesheet.match(/\.tagPreview::after\s*\{([^}]*)\}/)?.[1]
    const tagInputRule = editorStylesheet.match(/\.tagTextInput\s*\{([^}]*)\}/)?.[1]

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        mode="preview"
        previewLayout="editor"
        hero={hero}
        heroInfo={heroInfo}
        onModeToggle={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const cluster = screen.getByLabelText(`${hero.displayName} ability editor hero info`)
    const heroName = within(cluster).getByText('Mixed Name')

    expect(cluster).toHaveTextContent('Mixed case tag')
    expect(heroName).toHaveStyle({
      fontSize: '3.8rem',
      fontFamily: 'Georgia, serif',
      fontWeight: '600',
    })
    expect(screen.getByTestId('ability-mode-toggle').parentElement?.className).not.toContain('editorLayoutPreview')
    expect(screen.getByTestId('ability-editor-scroll-container').className).toContain('mainEditorColumnEditorPreview')
    expect(tagSizingRule).not.toMatch(/text-transform:\s*uppercase/)
    expect(tagInputRule).not.toMatch(/text-transform:\s*uppercase/)
  })

  it('renders preview grid cells without empty detail titles and exposes scaling values', () => {
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])
    const abilityStyles = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const previewMainRule = [...abilityStyles.matchAll(/\.mainEditorColumnPreview \.inlineStatEditorMain\s*\{([^}]*)\}/g)].at(-1)?.[1]
    const previewSubRule = abilityStyles.match(/\.mainEditorColumnPreview \.inlineStatEditorSub\s*\{([^}]*)\}/)?.[1]
    const previewDetailRule = abilityStyles.match(/\.mainEditorColumnPreview \.inlineStatEditorMain \.unitInput,[\s\S]*?\{([^}]*)\}/)?.[1]
    const previewColumnRule = abilityStyles.match(/\.mainEditorColumnPreview\s*\{([^}]*)\}/)?.[1]
    const mainScalingRule = abilityStyles.match(/\.inlineStatEditorMain \.scalingValueWrap\s*\{([^}]*)\}/)?.[1]
    const firstMainCellStackRule = abilityStyles.match(/\.mainEditorColumnPreview \.mainCellGrid > \.mainCell:nth-child\(1\)\s*\{([^}]*)\}/)?.[1]
    const secondMainCellStackRule = abilityStyles.match(/\.mainEditorColumnPreview \.mainCellGrid > \.mainCell:nth-child\(2\)\s*\{([^}]*)\}/)?.[1]
    const thirdMainCellStackRule = abilityStyles.match(/\.mainEditorColumnPreview \.mainCellGrid > \.mainCell:nth-child\(3\)\s*\{([^}]*)\}/)?.[1]

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
            unit: 'MissingHealthAsDamageThatSurpassesTheStatBoxLimit',
            append: '+very-long-append',
            scaling: 'spirit',
            scalingValue: '0.15',
          },
          {
            ...ability.cooldown,
            id: 'preview-titled-main-cell',
            label: 'Alt Cast',
            value: '-13',
            unit: 'Spirit Resist',
            append: '%',
            scaling: 'none',
            scalingValue: '0',
          },
        ],
        lowerCells: [
          {
            ...ability.cooldown,
            id: 'preview-lower-cell',
            label: 'VeryLongLowerStatLabelThatSurpassesTheStatBoxLimit',
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
    const titledMainStat = screen.getByTestId('ability-stat-main-alt-cast')
    const lowerStat = screen.getByTestId('ability-stat-lower-verylonglowerstatlabelthatsurpassesthestatboxlimit')
    const mainCell = mainStat.closest('[class*="mainCell"]')
    const titledMainCell = titledMainStat.closest('[class*="mainCell"]')
    const mainRow = mainStat.querySelector('[class*="mainRow"]')

    expect(screen.queryByLabelText('Main cell 1 title')).not.toBeInTheDocument()
    expect(mainCell?.querySelector('[class*="mainCellTitleSpacer"]')).toBeInTheDocument()
    expect(screen.getByLabelText('Main cell 2 title')).toHaveValue('Alt Cast')
    expect(titledMainCell?.querySelector('[class*="mainCellTitleLabel"]')).toBeInTheDocument()
    expect(mainRow).toBeInTheDocument()
    const scalingValue = within(mainStat).getByLabelText('spirit scaling value x0.15')

    expect(scalingValue).toBeInTheDocument()
    expect(scalingValue.parentElement?.className).not.toContain('rootValueLeft')
    expect(scalingValue.parentElement?.parentElement?.className).not.toContain('scalingValueWrapExpanded')
    expect(mainScalingRule).toMatch(/position:\s*absolute/)
    expect(previewColumnRule).toMatch(/width:\s*calc\(100% \+ 72px\)/)
    expect(previewColumnRule).toMatch(/padding-right:\s*72px/)
    expect(previewColumnRule).toMatch(/margin-right:\s*-72px/)
    expect(firstMainCellStackRule).toMatch(/z-index:\s*3/)
    expect(secondMainCellStackRule).toMatch(/z-index:\s*2/)
    expect(thirdMainCellStackRule).toMatch(/z-index:\s*1/)
    expect(within(mainStat).getByText('MissingHealthAsDamageThatSurpassesTheStatBoxLimit').className).toContain('readonlyStatText')
    expect(within(mainStat).getByText('+very-long-append').className).toContain('readonlyStatText')
    expect(within(mainStat).getByText('+very-long-append').className).toContain('readonlyStatTextNoWrap')
    expect(within(mainStat).getByText('MissingHealthAsDamageThatSurpassesTheStatBoxLimit').className).not.toContain('readonlyStatTextNoWrap')
    expect(within(lowerStat).getByText('VeryLongLowerStatLabelThatSurpassesTheStatBoxLimit').className).toContain('readonlyStatText')
    expect(previewMainRule).toMatch(/height:\s*auto/)
    expect(previewMainRule).toMatch(/min-height:\s*94px/)
    expect(previewSubRule).toMatch(/max-width:\s*100%/)
    expect(previewDetailRule).toMatch(/white-space:\s*normal/)
    expect(previewDetailRule).toMatch(/overflow-wrap:\s*anywhere/)
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
    await confirmFocusedGoBack(user)

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
    const chargesIcon = within(screen.getByTestId('ability-stat-timing-charges')).getByRole('button', { name: 'Choose Charges icon' }).querySelector('[aria-hidden="true"]')
    expect(chargesIcon).toHaveStyle({ backgroundImage: "url('/panorama/images/upgrades/property_cast_psd.png')" })
    expect(chargesIcon?.getAttribute('style')).not.toContain('mask-image')
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

    await confirmFocusedGoBack(user)

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
    const addedSubStat = savedAbility?.subStats.find(stat => stat.label === 'Stat')

    expect(addedSubStat).not.toHaveProperty('id')
    expect(savedRichText?.text).toContain('[b]')
    expect(savedRichText?.text).toContain('[c:healing]')
    expect(savedRichText?.text).toContain('[i:heal]')
    expect(savedRichText?.text.indexOf('[i:heal]')).toBeLessThan(savedRichText?.text.indexOf(' channels') ?? 0)
  })

  it('drags text and grid sections above or below each other across higher tiers', async () => {
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

    const descriptionHandle = screen.getByRole('button', { name: 'Reorder Description section' })
    const statsHandle = screen.getByRole('button', { name: 'Reorder Impact section' })
    const descriptionSection = descriptionHandle.closest('article')
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: vi.fn(),
    }

    expect(descriptionSection).not.toBeNull()
    const boundsSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 100,
      width: 500,
      height: 100,
      top: 100,
      right: 500,
      bottom: 200,
      left: 0,
      toJSON: () => ({}),
    })

    fireEvent.dragStart(statsHandle, { dataTransfer })
    const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 110 })

    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    fireEvent(descriptionSection!, dragOverEvent)

    expect(descriptionSection).toHaveAttribute('data-drop-position', 'before')

    fireEvent.drop(descriptionSection!, { clientY: 110, dataTransfer })
    boundsSpy.mockRestore()

    expect(screen.getAllByRole('button', { name: /Reorder .* section/ }).map(button => button.getAttribute('aria-label'))).toEqual([
      'Reorder Impact section',
      'Reorder Description section',
    ])

    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]

    expect(savedAbility?.sections.map(section => section.type)).toEqual(['grid', 'richText'])
    expect(savedAbility?.tiers.every(tier => tier.variant.sections.map(section => section.type).join(',') === 'grid,richText')).toBe(true)
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

    await confirmFocusedGoBack(user)

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

  it('keeps cooldown append text through tier cascades, saves, and preview rendering', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const onSave = vi.fn()

    const { unmount } = render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    const cooldown = screen.getByTestId('ability-stat-timing-cooldown')
    const appendInput = within(cooldown).getByLabelText('Append')

    await user.type(appendInput, '+')
    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))
    expect(within(screen.getByTestId('ability-stat-timing-cooldown')).getByLabelText('Append')).toHaveValue('+')
    await user.click(screen.getByRole('button', { name: 'Tier 3 upgrade' }))
    expect(within(screen.getByTestId('ability-stat-timing-cooldown')).getByLabelText('Append')).toHaveValue('+')
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]

    expect(savedAbility?.cooldown.append).toBe('+')
    expect(savedAbility?.tiers.every(tier => tier.variant.cooldown.append === '+')).toBe(true)

    unmount()
    render(
      <AbilityEditor
        ability={savedAbility!}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        mode="preview"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(within(screen.getByTestId('ability-stat-timing-cooldown')).getByText('+')).toBeInTheDocument()
  })

  it('cascades ability text edits from lower tiers into higher tiers', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const onSave = vi.fn()

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    function setAbilityText(text: string) {
      const editor = screen.getByRole('textbox', { name: 'Description rich text' })

      editor.textContent = text
      fireEvent.input(editor)
    }

    function expectAbilityText(text: string) {
      expect(screen.getByRole('textbox', { name: 'Description rich text' })).toHaveTextContent(text)
    }

    setAbilityText('Base inherited text')
    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))
    expectAbilityText('Base inherited text')

    setAbilityText('Tier one inherited text')
    await user.click(screen.getByRole('button', { name: 'Tier 2 upgrade' }))
    expectAbilityText('Tier one inherited text')

    await user.click(screen.getByRole('button', { name: 'Tier 3 upgrade' }))
    expectAbilityText('Tier one inherited text')

    await user.click(screen.getByRole('button', { name: '0' }))
    expectAbilityText('Base inherited text')

    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedTierTexts = savedAbility?.tiers.map(tier => {
      const richText = tier.variant.sections.find(section => section.type === 'richText')

      return richText?.text
    })

    expect(savedAbility?.sections.find(section => section.type === 'richText')?.text).toBe('Base inherited text')
    expect(savedTierTexts).toEqual(['Tier one inherited text', 'Tier one inherited text', 'Tier one inherited text'])
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
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')
    const iconTokens = savedRichText?.text.match(/\[i:heal\]/g) ?? []

    expect(iconTokens).toHaveLength(1)
    expect(savedRichText?.text).toContain('[dark][i:heal][/dark]')
  })

  it('does not save an extra blank line when dark text starts a new block', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'New ability detail.',
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

    richTextEditor.innerHTML = '<div>New ability detail.</div><div><span data-rich-dark="true"><br>aaaaaaaaaaaaaa</span></div>'
    fireEvent.input(richTextEditor)

    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toBe('New ability detail.\n[dark]aaaaaaaaaaaaaa[/dark]')
    expect(savedRichText?.text).not.toContain('\n\n')
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

    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('Abrams channels custom ability 1.')
    expect(savedRichText?.text).not.toContain('[b]Abrams')
    expect(savedRichText?.text).not.toContain('[i]Abrams')
    expect(savedRichText?.text).not.toContain('[dark]Abrams')
    expect(savedRichText?.text).not.toContain('[c:healing]Abrams')
  })

  it('unbolds only the selected part of an existing bold run', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: '[b]Abrams channels[/b]',
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

    const boldTextNode = richTextEditor.querySelector('strong')?.firstChild

    expect(boldTextNode).not.toBeNull()

    const range = document.createRange()

    range.setStart(boldTextNode!, 2)
    range.setEnd(boldTextNode!, 6)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    await user.click(screen.getByRole('button', { name: 'Bold selected text' }))
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toBe('[b]Ab[/b]rams[b] channels[/b]')
  })

  it('closes text swatches on outside click and exposes the expanded palette', async () => {
    const user = userEvent.setup()
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const swatchPanelRule = stylesheet.match(/\.swatchPanel\s*\{([^}]*)\}/)?.[1]

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
    expect(swatchPanelRule).toMatch(/position:\s*fixed/)
    expect(swatchPanelRule).toMatch(/z-index:\s*2200/)
    expect(swatchPanelRule).toMatch(/max-height:\s*calc\(100dvh - 16px\)/)
    expect(swatchPanelRule).not.toMatch(/bottom:\s*calc\(100% \+ 6px\)/)

    fireEvent.pointerDown(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Apply Orange color' })).not.toBeInTheDocument()
    })
  })

  it('adds custom text colors to recently made swatches and saves reusable custom color tokens', async () => {
    window.localStorage.removeItem('charlock_recent_rich_text_colors')

    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])

    ability.sections = [{
      id: 'description',
      type: 'richText',
      title: 'Description',
      text: 'Abrams channels custom ability 1.',
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
    const abramsTextNode = findTextNodeContaining(richTextEditor, 'Abrams')
    const abramsRange = document.createRange()

    abramsRange.setStart(abramsTextNode, 0)
    abramsRange.setEnd(abramsTextNode, 'Abrams'.length)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(abramsRange)

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))
    fireEvent.change(screen.getByLabelText('Custom text color'), { target: { value: '#123456' } })

    expect(richTextEditor.querySelector('[data-rich-custom-color="#123456"]')).not.toBeNull()
    expect(window.localStorage.getItem('charlock_recent_rich_text_colors')).toContain('#123456')

    const channelsTextNode = findTextNodeContaining(richTextEditor, 'channels')
    const channelsRange = document.createRange()
    const channelsStart = channelsTextNode.textContent?.indexOf('channels') ?? -1

    expect(channelsStart).toBeGreaterThanOrEqual(0)
    channelsRange.setStart(channelsTextNode, channelsStart)
    channelsRange.setEnd(channelsTextNode, channelsStart + 'channels'.length)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(channelsRange)

    await user.click(screen.getByRole('button', { name: 'Open text color swatches' }))

    expect(screen.getByText('Recently made')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply recently made #123456 color' }))
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).toContain('[c:#123456]Abrams[/c]')
    expect(savedRichText?.text).toContain('[c:#123456]channels[/c]')
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
    await confirmFocusedGoBack(user)

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
    await confirmFocusedGoBack(user)

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

    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')

    await user.click(screen.getByRole('button', { name: 'Add Main Cell' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeDisabled()

    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const mainRowRule = stylesheet.match(/^\.mainRow\s*\{([^}]*)\}/m)?.[1]
    const mainValueRule = stylesheet.match(/^\.inlineStatEditorMain \.valueInput\s*\{([^}]*)\}/m)?.[1]
    const mainAppendRule = stylesheet.match(/^\.inlineStatEditorMain \.appendInput\s*\{([^}]*)\}/m)?.[1]

    expect(mainRowRule).toMatch(/overflow:\s*hidden/)
    expect(mainValueRule).toMatch(/max-width:\s*100%/)
    expect(mainAppendRule).toMatch(/max-width:\s*100%/)

    await user.click(screen.getByRole('button', { name: 'Remove main cell 3' }))
    expect(mainCellGrid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(screen.getByRole('button', { name: 'Add Main Cell' })).toBeEnabled()

    await user.clear(screen.getByLabelText('Main cell 1 title'))
    await user.type(screen.getByLabelText('Main cell 1 title'), 'Impact Damage')
    await confirmFocusedGoBack(user)

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

    await confirmFocusedGoBack(user)

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

  it('keeps lower-stat IDs unique after removing and adding rows', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])
    const grid = ability.sections.find(section => section.type === 'grid')

    if (!grid) {
      throw new Error('Expected default grid section')
    }

    grid.lowerCells.push(
      { ...grid.lowerCells[0], id: `${grid.id}-lower-2`, label: 'Second' },
      { ...grid.lowerCells[0], id: `${grid.id}-lower-3`, label: 'Third' },
    )

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove lower cell 2' }))
    await user.click(screen.getByRole('button', { name: 'Add Lower Cell' }))
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedGrid = savedAbility?.sections.find(section => section.type === 'grid')
    const savedIds = savedGrid?.lowerCells.map(cell => cell.id) ?? []

    expect(savedIds).toHaveLength(3)
    expect(new Set(savedIds).size).toBe(savedIds.length)
  })

  it('disables adding lower stats at the save limit', () => {
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])
    const grid = ability.sections.find(section => section.type === 'grid')

    if (!grid) {
      throw new Error('Expected default grid section')
    }

    grid.lowerCells = Array.from({ length: 24 }, (_, index) => ({
      ...grid.lowerCells[0],
      id: `${grid.id}-lower-${index + 1}`,
    }))

    render(
      <AbilityEditor
        ability={ability}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Add Lower Cell' })).toBeDisabled()
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
    await confirmFocusedGoBack(user)

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

    const spiritSwatch = within(iconModal).getByRole('button', { name: 'Spirit icon color' })
    const stylesheet = readFileSync('components/AbilityEditor/AbilityEditor.module.css', 'utf8')
    const timingIconRule = stylesheet.match(/\.inlineStatEditorTiming \.propertyIcon\s*\{([^}]*)\}/)?.[1]

    expect(spiritSwatch).toHaveStyle({ backgroundColor: '#7e61a1' })
    expect(timingIconRule).toMatch(/color:\s*#7e61a1/)

    await user.click(spiritSwatch)
    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]

    expect(savedAbility?.subStats).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Range',
        icon: '/panorama/images/icons/properties/heal.svg',
        iconColor: '#7e61a1',
      }),
    ]))
  })

  it('recolors an existing stat icon without selecting the icon again', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ability = structuredClone(buildDefaultAbilityStats(HEROES[0]).abilities[0])
    const originalRangeIcon = ability.subStats.find(stat => stat.label === 'Range')?.icon

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

    await user.click(within(iconModal).getByRole('button', { name: 'Amber icon color' }))
    await user.click(within(iconModal).getByRole('button', { name: 'Close property icon selector' }))
    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRangeStat = savedAbility?.subStats.find(
      (stat: { label: string }) => stat.label === 'Range',
    )

    expect(savedRangeStat?.icon).toBe(originalRangeIcon)
    expect(savedRangeStat?.iconColor).toBe('#e5a535')
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

    await confirmFocusedGoBack(user)

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

    await confirmFocusedGoBack(user)

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

    await confirmFocusedGoBack(user)

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

    await confirmFocusedGoBack(user)

    const savedAbility = onSave.mock.calls[0]?.[0]
    const savedRichText = savedAbility?.sections.find(section => section.type === 'richText')

    expect(savedRichText?.text).not.toContain('[[inline-icon-marker:')
  })
})

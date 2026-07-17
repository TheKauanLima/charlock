// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HeroInfoCluster from '@/components/HeroInfoCluster/HeroInfoCluster'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import type { HeroDefinition } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('HeroInfoCluster', () => {
  it('opens boon rewards from the information tab and dismisses panels on outside click', async () => {
    const user = userEvent.setup()
    const hero = {
      slug: 'greytalon', assetSlug: 'grey_talon', displayName: 'Grey Talon', portrait: '/portrait.png', render: '/render.png',
      heroInfo: {
        nameType: 'text', nameValue: 'Grey Talon', nameColor: '#fff', tag1Text: 'A', tag2Text: 'B', tag3Text: 'C', tagColor: '#000', tagTextColor: '#fff',
        tag1Tilt: 0, tag2Tilt: 0, tag3Tilt: 0, tag1OffsetY: 0, tag2OffsetY: 0, tag3OffsetY: 0,
        ability1Icon: '/1.png', ability2Icon: '/2.png', ability3Icon: '/3.png', ability4Icon: '/4.png', abilityCircleColor: '#000', abilityIconColor: '#fff',
      },
    } satisfies HeroDefinition

    const stats = buildHeroStatsSeed(hero)
    stats.boon.panels = [{
      id: 'boon-alt',
      name: 'Aggressive',
      stats: stats.boon.stats.map(stat => stat.label === 'Base Bullet Damage' ? { ...stat, value: '2.5', scalingValue: '2.5' } : stat),
    }]

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(stats), { status: 200 }))
    render(<HeroInfoCluster hero={hero} />)

    expect(screen.getByTestId('boon-rewards-panel')).not.toBeVisible()
    expect(screen.getByTestId('hero-info-name-text')).toHaveTextContent('Grey Talon')
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('tabpanel', { name: 'Grey Talon boon rewards' }).className).toContain('tabPanelVisible')
    expect(screen.getByTestId('boon-rewards-panel')).toBeInTheDocument()
    await user.click(await screen.findByRole('tab', { name: 'Aggressive' }))
    expect(within(screen.getByTestId('boon-rewards-panel')).getByText('2.5')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.getByTestId('boon-rewards-panel')).not.toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByTestId('boon-rewards-panel')).toHaveAccessibleName('Grey Talon boon rewards')
  })

  it('does not use hero tags or generated stats as a custom hero weapon fallback', async () => {
    const user = userEvent.setup()
    const hero = {
      id: '507f1f77bcf86cd799439011',
      slug: 'petrichor',
      assetSlug: 'petrichor',
      displayName: 'Petrichor',
      portrait: '/panorama/images/heroes/petrichor.png',
      render: '/render/Petrichor_Render.png',
      heroInfo: {
        nameType: 'text',
        nameValue: 'Petrichor',
        nameColor: '#f1e7d2',
        tag1Text: 'Risk of',
        tag2Text: 'rain 2',
        tag3Text: 'Storm',
        tagColor: '#473424',
        tagTextColor: '#fff4df',
        tag1Tilt: -4.5,
        tag2Tilt: 1.2,
        tag3Tilt: 6.8,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/petrichor/1.png',
        ability2Icon: '/panorama/images/hud/abilities/petrichor/2.png',
        ability3Icon: '/panorama/images/hud/abilities/petrichor/3.png',
        ability4Icon: '/panorama/images/hud/abilities/petrichor/4.png',
        abilityCircleColor: '#f0ad5f',
        abilityIconColor: '#ffe5b8',
      },
    } satisfies HeroDefinition & { id: string }

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined))

    render(<HeroInfoCluster hero={hero} />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponPanel = screen.getByTestId('weapon-panel')

    expect(weaponPanel).toHaveTextContent('Petrichor Weapon')
    expect(weaponPanel).not.toHaveTextContent('Risk of')
    expect(weaponPanel).not.toHaveTextContent('rain 2')
    expect(screen.getByRole('button', { name: /Bullet Damage: 0/ })).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/heroes/507f1f77bcf86cd799439011/stats', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('does not copy hero tags into generated weapon tags', () => {
    const hero = {
      slug: 'petrichor',
      assetSlug: 'petrichor',
      displayName: 'Petrichor',
      portrait: '/panorama/images/heroes/petrichor.png',
      render: '/render/Petrichor_Render.png',
      heroInfo: {
        nameType: 'text',
        nameValue: 'Petrichor',
        nameColor: '#f1e7d2',
        tag1Text: 'Risk of',
        tag2Text: 'rain 2',
        tag3Text: 'Storm',
        tagColor: '#473424',
        tagTextColor: '#fff4df',
        tag1Tilt: -4.5,
        tag2Tilt: 1.2,
        tag3Tilt: 6.8,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/petrichor/1.png',
        ability2Icon: '/panorama/images/hud/abilities/petrichor/2.png',
        ability3Icon: '/panorama/images/hud/abilities/petrichor/3.png',
        ability4Icon: '/panorama/images/hud/abilities/petrichor/4.png',
        abilityCircleColor: '#f0ad5f',
        abilityIconColor: '#ffe5b8',
      },
    } satisfies HeroDefinition

    expect(buildHeroStatsSeed(hero).weapon.weaponAttributes).toEqual([])
  })

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
    expect(screen.getByTestId('hero-info-ability-1')).toHaveAttribute('style', expect.stringContaining('background: rgb(240, 173, 95)'))
    expect(screen.getByTestId('hero-info-ability-1').querySelector('[aria-hidden="true"]')).toHaveStyle({ backgroundColor: '#ffe5b8' })
    expect(screen.getByRole('button', { name: 'View Grey Talon character backstory' })).toBeInTheDocument()
  })

  it('renders saved secondary ability icons and opens the shared ability editor in preview mode', async () => {
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
    const abilityStats = buildDefaultAbilityStats(hero)

    abilityStats.secondaryAbilities = [0, 2, 3].map((primaryIndex, index) => ({
      ...abilityStats.abilities[primaryIndex],
      slot: primaryIndex + 1,
      icon: `/secondary-${index + 1}.svg`,
    }))
    abilityStats.secondaryAbilitySlots = [0, 2, 3]
    abilityStats.abilities[0] = {
      ...abilityStats.abilities[0],
      name: 'Base Snare',
      hasCharges: true,
      tiers: abilityStats.abilities[0].tiers.map(tier => tier.tier === 1
        ? {
          ...tier,
          upgradeText: '[b]+150[/b] snare duration',
          variant: {
            ...tier.variant,
            name: 'Tier Snare',
          },
        }
        : tier),
    }

    render(<HeroInfoCluster hero={{ ...hero, abilityStats }} />)

    expect(screen.queryByTestId('hero-info-secondary-ability-1')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-secondary-ability-2')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-info-secondary-ability-3')).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-ability-1')).toHaveAttribute('style', expect.stringContaining('radial-gradient'))
    expect(screen.getByTestId('hero-info-ability-2')).not.toHaveAttribute('style', expect.stringContaining('radial-gradient'))
    expect(screen.getByTestId('hero-info-secondary-ability-1').querySelector('[aria-hidden="true"]')).toHaveAttribute('style', expect.stringContaining('/secondary-1.svg'))

    await user.click(screen.getByRole('button', { name: 'View Ability 1' }))

    const abilityEditor = screen.getByTestId('ability-editor')
    expect(abilityEditor).toHaveTextContent('Base Snare')
    expect(abilityEditor.className).toContain('abilityViewerDock')
    expect(abilityEditor.querySelector('[class*="editorLayoutPreview"]')).toBeInTheDocument()
    expect(abilityEditor.querySelector('[class*="mainEditorColumnPreview"]')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Main Cell' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bold selected text' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Append ability sections')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Second Ability Set')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ability-editor-hero-info-ability-1')).not.toBeInTheDocument()
    expect(screen.queryByText('Charges')).not.toBeInTheDocument()
    expect(screen.getByTestId('ability-stat-timing-charges')).toBeInTheDocument()
    expect(screen.getByTestId('ability-stat-timing-recharge-time')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('+')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tier 1 upgrade' }))

    expect(screen.getByTestId('ability-editor')).toHaveTextContent('Base Snare')
    expect(screen.getByTestId('ability-editor')).not.toHaveTextContent('Tier Snare')
    expect(screen.getByTestId('ability-editor')).toHaveTextContent('+150')

    fireEvent.pointerDown(document.body)

    expect(screen.queryByTestId('ability-editor')).not.toBeInTheDocument()
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
    expect(screen.getByTestId('boon-rewards-panel')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByTestId('hero-info-name-image')).toBeInTheDocument()
  })

  it('shows scaling value details from the parent showDetails prop', async () => {
    const user = userEvent.setup()
    const hero = {
      id: '507f1f77bcf86cd799439011',
      slug: 'greytalon',
      assetSlug: 'grey_talon',
      displayName: 'Grey Talon',
      portrait: '/panorama/images/heroes/greytalon.png',
      render: '/render/Grey_Talon_Render.png',
      bookmarkedByCurrentUser: false,
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
    } satisfies HeroDefinition & { id: string; bookmarkedByCurrentUser: boolean }
    const stats = buildHeroStatsSeed(hero)

    stats.weapon.stats[0] = {
      ...stats.weapon.stats[0],
      scaling: 'spirit',
      scalingValue: '0.2',
    }
    stats.weapon.panels = [{
      id: 'shotgun-panel',
      name: 'Shotgun',
      weaponDesc: 'A close range scatter profile.',
      gunImageSrc: '/panel-shotgun.png',
      weaponAttributes: ['Close Range', 'Pellet'],
      bulletDPS: 180,
      weaponMinRange: 8,
      weaponMaxRange: 22,
      stats: stats.weapon.stats.map(stat => stat.label === 'Bullet Damage' ? { ...stat, value: '99' } : stat),
    }]

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(stats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { rerender } = render(<HeroInfoCluster hero={hero} />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))
    await screen.findByTestId('weapon-panel')

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2').className).not.toContain('valueWrapVisible')

    await user.click(screen.getByRole('tab', { name: 'Shotgun' }))
    expect(screen.getByTestId('weapon-panel')).toHaveAccessibleName('Shotgun weapon stats')
    expect(screen.getByText('A close range scatter profile.')).toBeInTheDocument()
    expect(screen.getByText('Close Range')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Shotgun weapon' })).toHaveAttribute('style', expect.stringContaining('/panel-shotgun.png'))
    expect(screen.getByRole('button', { name: /Bullet Damage: 99/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: stats.weapon.weaponName, exact: true }))
    expect(screen.queryByText('A close range scatter profile.')).not.toBeInTheDocument()
    expect(screen.queryByText('Close Range')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bullet Damage: / })).not.toHaveAccessibleName(/99/)

    rerender(<HeroInfoCluster hero={hero} showDetails />)

    expect(screen.getByLabelText('spirit scaling value x0.2').className).toContain('valueWrapVisible')
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
    const fetchedAbilityStats = buildDefaultAbilityStats(hero)

    fetchedStats.vitality.stats[0] = {
      ...fetchedStats.vitality.stats[0],
      value: '999',
    }
    fetchedAbilityStats.secondaryAbilities = fetchedAbilityStats.abilities.slice(0, 3).map((ability, index) => ({
      ...ability,
      icon: `/fetched-secondary-${index + 1}.svg`,
    }))
    fetchedAbilityStats.secondaryAbilitySlots = [0, 1, 2]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        ...fetchedStats,
        abilityStats: fetchedAbilityStats,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<HeroInfoCluster hero={hero} />)

    expect(await screen.findByTestId('hero-info-secondary-ability-1')).toHaveAttribute('style', expect.stringContaining('background-color'))
    await user.click(screen.getByRole('tab', { name: 'Vitality stats' }))

    expect(await screen.findByRole('button', { name: /Max Health: 999/ })).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/heroes/greytalon/stats', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('fetches persisted browse hero ability stats by custom hero id', async () => {
    const hero = {
      id: '507f1f77bcf86cd799439011',
      slug: 'abrams',
      assetSlug: 'abrams',
      displayName: 'Custom Abrams',
      portrait: '/panorama/images/heroes/abrams.png',
      render: '/render/Abrams_Render.png',
      heroInfo: {
        nameType: 'text',
        nameValue: 'Custom Abrams',
        nameColor: '#f1e7d2',
        tag1Text: 'Tank',
        tag2Text: 'Brawler',
        tag3Text: 'Bull-Headed',
        tagColor: '#1297b7',
        tagTextColor: '#fff4df',
        tag1Tilt: -3,
        tag2Tilt: 4,
        tag3Tilt: 6,
        tag1OffsetY: -10,
        tag2OffsetY: 0,
        tag3OffsetY: 10,
        ability1Icon: '/panorama/images/hud/abilities/abrams/1.png',
        ability2Icon: '/panorama/images/hud/abilities/abrams/2.png',
        ability3Icon: '/panorama/images/hud/abilities/abrams/3.png',
        ability4Icon: '/panorama/images/hud/abilities/abrams/4.png',
        abilityCircleColor: '#1599b8',
        abilityIconColor: '#0c1516',
      },
    } satisfies HeroDefinition & { id: string }
    const fetchedStats = buildHeroStatsSeed(hero)
    const fetchedAbilityStats = buildDefaultAbilityStats(hero)

    fetchedAbilityStats.secondaryAbilities = fetchedAbilityStats.abilities.slice(0, 3).map((ability, index) => ({
      ...ability,
      icon: `/browse-secondary-${index + 1}.svg`,
    }))
    fetchedAbilityStats.secondaryAbilitySlots = [0, 1, 2]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        ...fetchedStats,
        abilityStats: fetchedAbilityStats,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<HeroInfoCluster hero={hero} />)

    expect(await screen.findByTestId('hero-info-secondary-ability-1')).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/heroes/507f1f77bcf86cd799439011/stats', expect.objectContaining({ signal: expect.any(AbortSignal) }))
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

    await user.click(screen.getByRole('button', { name: 'Bookmark Arc Light' }))
    expect(await screen.findByRole('button', { name: 'Remove Arc Light bookmark' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export Character/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Arc Light comments' }))

    const commentsDialog = await screen.findByRole('dialog', { name: 'Arc Light comments' })

    expect(within(commentsDialog).getByText('Strong silhouette.')).toBeInTheDocument()
    expect(within(commentsDialog).getByRole('button', { name: 'Post comment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report character' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/507f1f77bcf86cd799439011/comments', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})

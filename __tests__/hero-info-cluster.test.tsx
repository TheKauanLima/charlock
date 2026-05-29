// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import HeroInfoCluster from '@/components/hero-info-cluster'
import type { HeroDefinition } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

describe('HeroInfoCluster', () => {
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
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('src', expect.stringContaining('/panorama/images/heroes/hero_names/grey_talon.svg'))
    expect(screen.getByTestId('hero-info-tag-1')).toHaveAttribute('style', expect.stringContaining('background-color: rgb(71, 52, 36)'))
    expect(screen.getByTestId('hero-info-tag-1')).toHaveAttribute('style', expect.stringContaining('color: rgb(255, 244, 223)'))
    const tag1 = screen.getByTestId('hero-info-tag-1')
    const tag2 = screen.getByTestId('hero-info-tag-2')
    const tag3 = screen.getByTestId('hero-info-tag-3')

    expect(tag1).not.toHaveStyle({ transform: tag2.style.transform })
    expect(tag1).not.toHaveStyle({ transform: tag3.style.transform })
    expect(tag2).not.toHaveStyle({ transform: tag3.style.transform })
    expect(tag1.style.transform).toMatch(/^rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(tag2.style.transform).toMatch(/^rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(tag3.style.transform).toMatch(/^rotate\(-?\d+(?:\.\d+)?deg\)$/)
    expect(screen.getByTestId('hero-info-ability-1')).toHaveAttribute('style', expect.stringContaining('background-color: rgb(240, 173, 95)'))
    expect(screen.getByTestId('hero-info-ability-1').querySelector('[aria-hidden="true"]')).toHaveStyle({ backgroundColor: '#ffe5b8' })
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
})
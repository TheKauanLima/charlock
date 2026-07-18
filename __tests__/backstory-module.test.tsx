// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import BackstoryModule, { getProminentColorFromPixels, getRgbTriplet } from '@/components/backstory/BackstoryModule'
import type { HeroDefinition } from '@/lib/hero-data'

const TEST_HERO = {
  slug: 'test-hero',
  assetSlug: 'test-hero',
  displayName: 'Test Hero',
  portrait: '/panorama/images/heroes/abrams.png',
  render: '/render/Abrams_Render.png',
  heroInfo: {
    nameType: 'text',
    nameValue: 'Test Hero',
    nameColor: '#ffefd6',
    tag1Text: 'Pressure',
    tag2Text: 'Frontline',
    tag3Text: 'Burst',
    tagColor: '#123456',
    tagTextColor: '#fff4df',
    tag1Tilt: 0,
    tag2Tilt: 0,
    tag3Tilt: 0,
    tag1OffsetY: 0,
    tag2OffsetY: 0,
    tag3OffsetY: 0,
    ability1Icon: '/panorama/images/hud/abilities/abrams/1.png',
    ability2Icon: '/panorama/images/hud/abilities/abrams/2.png',
    ability3Icon: '/panorama/images/hud/abilities/abrams/3.png',
    ability4Icon: '/panorama/images/hud/abilities/abrams/4.png',
    abilityCircleColor: '#2fc890',
    abilityIconColor: '#ffe5b8',
    backstory: 'A first line of backstory.\n\nA second line survives formatting.',
  },
} satisfies HeroDefinition

afterEach(() => {
  cleanup()
})

describe('BackstoryModule', () => {
  it('opens a themed dialog with hero backstory content', async () => {
    const user = userEvent.setup()

    render(<BackstoryModule hero={TEST_HERO} />)

    await user.click(screen.getByRole('button', { name: 'View Test Hero character backstory' }))

    expect(screen.getByRole('dialog', { name: 'BACKSTORY:' })).toBeInTheDocument()
    expect(screen.getByText(/A first line of backstory/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('style', expect.stringContaining('--backstory-accent: #2fc890'))
    expect(screen.getByRole('dialog')).toHaveAttribute('style', expect.stringContaining('--backstory-accent-rgb: 47, 200, 144'))
  })

  it('closes from the close button and Escape key', async () => {
    const user = userEvent.setup()

    render(<BackstoryModule hero={TEST_HERO} />)

    await user.click(screen.getByRole('button', { name: 'View Test Hero character backstory' }))
    await user.click(screen.getByRole('button', { name: 'CLOSE' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Test Hero character backstory' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when no backstory exists', async () => {
    const user = userEvent.setup()
    const heroWithoutBackstory = {
      ...TEST_HERO,
      heroInfo: {
        ...TEST_HERO.heroInfo,
        backstory: undefined,
      },
    } satisfies HeroDefinition

    render(<BackstoryModule hero={heroWithoutBackstory} />)

    await user.click(screen.getByRole('button', { name: 'View Test Hero character backstory' }))

    expect(screen.getByText('No character backstory has been added yet.')).toBeInTheDocument()
  })

  it('keeps focus inside the editable modal while it is open', async () => {
    const user = userEvent.setup()
    const onBackstoryChange = () => undefined

    render(
      <>
        <BackstoryModule hero={TEST_HERO} isEditable onBackstoryChange={onBackstoryChange} />
        <input aria-label="Outside field" />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Edit Test Hero character backstory' }))

    const backstoryInput = screen.getByLabelText('Backstory')
    const closeButton = screen.getByRole('button', { name: 'CLOSE' })

    expect(backstoryInput).toHaveFocus()
    expect(backstoryInput).toHaveAttribute('rows', '15')
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.tab()
    expect(backstoryInput).toHaveFocus()
    expect(screen.getByLabelText('Outside field')).not.toHaveFocus()

    await user.click(closeButton)
    expect(document.body.style.overflow).toBe('')
  })

  it('derives a prominent sampled color while ignoring transparent pixels', () => {
    const transparent = [255, 0, 0, 0]
    const teal = [34, 180, 140, 255]
    const grey = [92, 92, 92, 255]
    const pixels = new Uint8ClampedArray([
      ...transparent,
      ...teal,
      ...teal,
      ...teal,
      ...grey,
    ])

    expect(getProminentColorFromPixels(pixels)).toBe('#22b48c')
    expect(getRgbTriplet('#2fc890')).toBe('47, 200, 144')
  })
})

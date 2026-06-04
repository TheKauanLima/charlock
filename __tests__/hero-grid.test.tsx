// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HeroGrid from '@/components/hero-grid'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.priority

    return React.createElement('img', imageProps)
  },
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('HeroGrid', () => {
  it('renders 38 heroes and 2 empty slots', () => {
    render(<HeroGrid />)

    expect(screen.getAllByTestId('hero-card')).toHaveLength(38)
    expect(screen.getAllByTestId('hero-empty-slot')).toHaveLength(2)
  })

  it('updates the active render when a hero is clicked', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    expect(screen.getByRole('img', { name: 'Abrams render' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'abrams')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/hero_names/abrams.svg'))

    await user.click(screen.getByRole('button', { name: 'Select hero Grey Talon' }))

    expect(await screen.findByRole('img', { name: 'Grey Talon render' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'greytalon')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/hero_names/grey_talon.svg'))
  })

  it('updates the integrated stat panel when the active hero changes', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    expect(screen.getByTestId('weapon-panel')).toHaveTextContent('Abrams Weapon')

    await user.click(screen.getByRole('button', { name: 'Select hero Grey Talon' }))

    expect(await screen.findByText('Grey Talon Weapon')).toBeInTheDocument()
    expect(screen.getByTestId('weapon-panel')).not.toHaveTextContent('Abrams Weapon')
  })

  it('opens the create editor and updates the render background', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByTestId('hero-info-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-card')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Selected editor background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Abrams character backstory' })).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('editor-background-select'), '/panorama/images/heroes/backgrounds/yamato_bg_psd.png')

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('uses the top create sidebar tab to replace the background with an existing hero render', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByRole('tab', { name: 'Hero render' })).toBeInTheDocument()
    expect(screen.getByTestId('editor-name-image')).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('editor-background-select'), '/panorama/images/heroes/backgrounds/yamato_bg_psd.png')
    await user.click(screen.getByRole('button', { name: 'Asset' }))

    expect(screen.getByTestId('hero-render-modal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByTestId('hero-render-layer')).toHaveAttribute('style', expect.stringContaining('/render/Grey_Talon_Render.png'))
    expect(screen.getByTestId('hero-render-layer')).not.toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/backgrounds/yamato_bg_psd.png'))
  })

  it('edits hero identity fields in create mode in real time', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'text' }))

    await user.clear(screen.getByLabelText('Name Text'))
    await user.type(screen.getByLabelText('Name Text'), 'Arc Light')
    expect(screen.getByTestId('editor-name-text')).toHaveTextContent('Arc Light')

    await user.clear(screen.getByLabelText('Tag 1'))
    await user.type(screen.getByLabelText('Tag 1'), 'Skyline Breaker')
    expect(screen.getByTestId('editor-tag-1')).toHaveTextContent('Skyline Breaker')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('w-fit')
    expect(screen.getByTestId('editor-tags-row')).toHaveClass('flex-nowrap')
    expect(screen.getByTestId('editor-tag-1')).toHaveClass('shrink-0')
    expect(screen.getByTestId('editor-tag-1').querySelector('span')).toHaveClass('whitespace-nowrap')

    await user.clear(screen.getByLabelText('Tag 1 tilt'))
    await user.type(screen.getByLabelText('Tag 1 tilt'), '12')
    fireEvent.change(screen.getByLabelText('Tag 1 vertical position'), { target: { value: '-6' } })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(12deg) translateY(-6px)' })

    fireEvent.wheel(screen.getByTestId('editor-tag-1'), { deltaY: 100 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(12.5deg) translateY(-6px)' })

    fireEvent.pointerDown(screen.getByTestId('editor-tag-1'), { button: 0, clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('editor-tag-1'), { clientX: 30, pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('editor-tag-1'), { pointerId: 1 })
    expect(screen.getByTestId('editor-tag-1')).toHaveStyle({ transform: 'rotate(17.5deg) translateY(-6px)' })

    await user.clear(screen.getByLabelText('Hero Name hex value'))
    await user.type(screen.getByLabelText('Hero Name hex value'), '#123456')
    expect(screen.getByTestId('editor-name-text')).toHaveStyle({ color: '#123456' })

    const backstoryInput = screen.getByLabelText('Backstory')

    expect(backstoryInput).toHaveAttribute('wrap', 'soft')
    expect(backstoryInput).toHaveClass('overflow-y-auto')
    expect(backstoryInput).toHaveClass('overflow-x-hidden')

    await user.type(backstoryInput, 'Raised under neon rooftops, Arc Light learned to bottle thunder.')
    await user.click(screen.getByRole('button', { name: 'View Abrams character backstory' }))
    expect(within(screen.getByRole('dialog', { name: 'BACKSTORY:' })).getByText('Raised under neon rooftops, Arc Light learned to bottle thunder.')).toBeInTheDocument()
  })

  it('selects an ability icon from the create editor modal', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('button', { name: 'Choose Ability 1 icon' }))

    const modal = screen.getByTestId('ability-icon-modal')

    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText('Abrams')).toBeInTheDocument()
    expect(within(modal).getByText('Grey Talon')).toBeInTheDocument()
    expect(within(modal).getByText('Upload custom icon')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon ability 2' }))

    const abilityMask = screen.getByTestId('editor-ability-1').querySelector('[aria-hidden="true"]')

    expect(abilityMask).toHaveAttribute('style', expect.stringContaining('/panorama/images/hud/abilities/grey_talon/2.png'))
    expect(screen.queryByTestId('ability-icon-modal')).not.toBeInTheDocument()
  })

  it('edits weapon panel stats with reactive modifier math', async () => {
    const user = userEvent.setup()
    const abrams = HEROES.find(hero => hero.slug === 'abrams')

    expect(abrams).toBeDefined()

    const seed = buildHeroStatsSeed(abrams!)
    const baseBulletDamage = Number(seed.weapon.stats.find(stat => stat.label === 'Bullet Damage')?.value ?? 0)
    const bulletsPerSecond = Number(seed.weapon.stats.find(stat => stat.label === 'Bullets per sec')?.value ?? 0)
    const expectedBulletDamage = (baseBulletDamage * 1.25).toFixed(1)
    const expectedDps = Math.floor(Number(expectedBulletDamage) * bulletsPerSecond)

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageInput = screen.getByLabelText('Weapon Damage value')

    await user.clear(weaponDamageInput)
    await user.type(weaponDamageInput, '25')

    expect(screen.getByLabelText('Bullet Damage value')).toHaveValue(expectedBulletDamage)
    expect(screen.getByText(String(expectedDps))).toBeInTheDocument()
    expect(screen.getByText('DPS')).toBeInTheDocument()
  })

  it('cycles scaling and edits weapon header assets in create mode', async () => {
    const user = userEvent.setup()

    render(<HeroGrid />)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    await user.click(screen.getByRole('tab', { name: 'Weapon stats' }))

    const weaponDamageCell = screen.getByRole('button', { name: /Weapon Damage:/ })
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'none')

    await user.click(weaponDamageCell)
    expect(weaponDamageCell).toHaveAttribute('data-scaling', 'spirit')

    const weaponMiniEditor = screen.getByTestId('weapon-mini-editor')

    await user.clear(within(weaponMiniEditor).getByLabelText('Name'))
    await user.type(within(weaponMiniEditor).getByLabelText('Name'), 'Solar Repeater')
    expect(screen.getByText('Solar Repeater')).toBeInTheDocument()

    await user.clear(within(weaponMiniEditor).getByLabelText('Tags'))
    await user.type(within(weaponMiniEditor).getByLabelText('Tags'), 'Burst, Control')
    expect(screen.getByText('Burst')).toBeInTheDocument()
    expect(screen.getByText('Control')).toBeInTheDocument()

    await user.click(within(weaponMiniEditor).getByRole('button', { name: 'Asset' }))
    expect(screen.getByTestId('weapon-image-modal')).toBeInTheDocument()
    expect(screen.getByTestId('weapon-image-modal')).toHaveClass('pointer-events-auto')

    await user.click(screen.getByRole('button', { name: 'Use Grey Talon' }))

    expect(screen.getByRole('img', { name: 'Solar Repeater weapon' })).toHaveAttribute('style', expect.stringContaining('/panorama/images/heroes/guns/Grey_Talon_Weapon.png'))
    expect(screen.queryByTestId('weapon-image-modal')).not.toBeInTheDocument()
  })
})

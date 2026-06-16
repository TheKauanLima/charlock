// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import { buildSpiritPowerStat } from '@/components/panels/spirit-stats-mapper'
import { buildVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'

afterEach(() => {
  cleanup()
})

describe('hero stat mappers', () => {
  it('maps row values and scaling metadata into weapon stats', () => {
    const stats = buildWeaponStatsArray({
      bullet_damage: 13.5,
      bullet_damage_spirit_scaling: 0.2,
      fire_rate_percent: 18,
      fire_rate_percent_weapon_scaling: 0.4,
      heavy_melee_damage: 122,
      heavy_melee_damage_weapon_scaling: 0.6,
    })

    expect(stats[0]).toMatchObject({ label: 'Bullet Damage', value: '13.5', scaling: 'spirit', scalingValue: '0.2' })
    expect(stats[3]).toMatchObject({ label: 'Fire Rate', value: '18', scaling: 'courage', scalingValue: '0.4' })
    expect(stats[13]).toMatchObject({ label: 'Heavy Melee', value: '122', scaling: 'melee', scalingValue: '0.6' })
  })

  it('falls back to defaults when optional rows are omitted', () => {
    expect(buildVitalityStatsArray()[0]).toMatchObject({ label: 'Max Health', value: '810', scaling: 'none' })
    expect(buildSpiritPowerStat()).toMatchObject({ label: 'Spirit Power', value: '0', description: expect.stringContaining('Spirit Power') })
  })
})

describe('migrated stat panels', () => {
  it('renders vitality and spirit defaults', () => {
    render(
      <>
        <HeroStatsVitalityPanel />
        <HeroStatsSpiritPanel />
      </>,
    )

    expect(screen.getByTestId('hero-stats-vitality-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Max Health: 810/ })).toBeInTheDocument()
    expect(screen.getByTestId('hero-stats-spirit-panel')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spirit Power Impact' })).toBeInTheDocument()
    expect(screen.getByText(/increases the effectiveness/i)).toBeInTheDocument()
  })

  it('edits weapon stats and cycles scaling state without panel-local save actions', async () => {
    const user = userEvent.setup()

    render(<WeaponPanel isEditable />)

    const bulletDamageButton = screen.getByRole('button', { name: /Bullet Damage/ })
    expect(bulletDamageButton).toHaveAttribute('data-scaling', 'none')

    await user.click(bulletDamageButton)
    expect(bulletDamageButton).toHaveAttribute('data-scaling', 'spirit')

    const scalingInput = screen.getByLabelText('spirit scaling value')
    expect(scalingInput).toHaveStyle({ color: '#e1a0ff' })
    expect(scalingInput).toHaveAttribute('style', expect.stringContaining('-webkit-text-stroke: 3px #2c1139'))
    expect(scalingInput).toHaveClass('bg-transparent')
    expect(scalingInput).toHaveClass('border-0')
    expect(scalingInput.parentElement).toHaveTextContent('x')

    await user.clear(scalingInput)
    await user.type(scalingInput, '12.345')
    expect(scalingInput).toHaveValue('12.34')

    const bulletDamageInput = screen.getByLabelText('Bullet Damage value')
    await user.clear(bulletDamageInput)
    await user.type(bulletDamageInput, '8.5')

    expect(bulletDamageInput).toHaveValue('8.5')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('always shows scaling icons but hides numeric scaling values until showDetails is enabled', () => {
    const weaponStats = [
      { label: 'Bullet Damage', value: '13.5', unit: '', icon: 'bulletDamage', scaling: 'spirit' as const, scalingValue: '0.2' },
    ]

    const { rerender } = render(<WeaponPanel weaponStats={weaponStats} />)

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.queryByLabelText('spirit scaling value x0.2')).not.toBeInTheDocument()

    rerender(<WeaponPanel weaponStats={weaponStats} showDetails />)

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2')).toBeInTheDocument()

    rerender(<WeaponPanel weaponStats={weaponStats} isEditable />)

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
  })
})

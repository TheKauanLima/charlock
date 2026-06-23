// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
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

  it('edits weapon stats and scaling from the dropdown without panel-local save actions', async () => {
    const user = userEvent.setup()

    render(
      <WeaponPanel
        isEditable
        weaponMinRange={15}
        weaponMaxRange={40}
        onWeaponNameChange={() => undefined}
        onWeaponMinRangeChange={() => undefined}
        onWeaponMaxRangeChange={() => undefined}
      />,
    )

    const bulletDamageCell = screen.getByRole('group', { name: /Bullet Damage/ })
    expect(bulletDamageCell).toHaveAttribute('data-scaling', 'none')

    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Edit Bullet Damage scaling' }))
    expect(screen.getByRole('dialog', { name: 'Bullet Damage scaling controls' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set Bullet Damage scaling to spirit' }))
    expect(bulletDamageCell).toHaveAttribute('data-scaling', 'spirit')

    const scalingInput = screen.getByLabelText('Bullet Damage scaling value')

    expect(scalingInput).toHaveAttribute('placeholder', '0')
    await user.clear(scalingInput)
    await user.type(scalingInput, '12.345')
    expect(scalingInput).toHaveValue('12.34')

    const bulletDamageInput = screen.getByLabelText('Bullet Damage value')
    expect(bulletDamageInput).toHaveAttribute('placeholder', '0')
    expect(screen.getByLabelText('Weapon name')).toHaveAttribute('placeholder', 'Weapon name')
    expect(screen.getByLabelText('Minimum falloff range')).toHaveAttribute('placeholder', '0')
    expect(screen.getByLabelText('Maximum falloff range')).toHaveAttribute('placeholder', '0')
    await user.clear(bulletDamageInput)
    await user.type(bulletDamageInput, '8.5')

    expect(bulletDamageInput).toHaveValue('8.5')
    await user.click(screen.getByText('Weapon description'))
    expect(screen.queryByRole('dialog', { name: 'Bullet Damage scaling controls' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('edits vitality and spirit stat scaling from the same dropdown control', async () => {
    const user = userEvent.setup()

    render(
      <>
        <HeroStatsVitalityPanel isEditable />
        <HeroStatsSpiritPanel isEditable />
      </>,
    )

    const vitalityPanel = screen.getByTestId('hero-stats-vitality-panel')
    const maxHealthCell = within(vitalityPanel).getByRole('group', { name: /Max Health/ })
    expect(within(maxHealthCell).getByLabelText('Max Health value')).toHaveAttribute('placeholder', '0')

    await user.click(within(maxHealthCell).getByRole('button', { name: 'Edit Max Health scaling' }))
    await user.click(screen.getByRole('button', { name: 'Set Max Health scaling to boon' }))
    expect(maxHealthCell).toHaveAttribute('data-scaling', 'boon')
    await user.clear(screen.getByLabelText('Max Health scaling value'))
    await user.type(screen.getByLabelText('Max Health scaling value'), '0.8759')
    expect(screen.getByLabelText('Max Health scaling value')).toHaveValue('0.8759')

    const spiritPanel = screen.getByTestId('hero-stats-spirit-panel')
    const spiritPowerCell = within(spiritPanel).getByRole('group', { name: /Spirit Power/ })
    expect(within(spiritPowerCell).getByLabelText('Spirit Power value')).toHaveAttribute('placeholder', '0')

    await user.click(within(spiritPowerCell).getByRole('button', { name: 'Edit Spirit Power scaling' }))
    expect(screen.queryByRole('dialog', { name: 'Max Health scaling controls' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set Spirit Power scaling to melee' }))
    expect(spiritPowerCell).toHaveAttribute('data-scaling', 'melee')
  })

  it('always shows scaling icons but hides numeric scaling values until showDetails is enabled', () => {
    const weaponStats = [
      { label: 'Bullet Damage', value: '13.5', unit: '', icon: 'bulletDamage', scaling: 'spirit' as const, scalingValue: '0.2' },
    ]

    const { rerender } = render(<WeaponPanel weaponStats={weaponStats} />)

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2').className).not.toContain('valueWrapVisible')

    rerender(<WeaponPanel weaponStats={weaponStats} showDetails />)

    expect(screen.getByTitle('spirit scaling 0.2')).toBeInTheDocument()
    expect(screen.getByLabelText('spirit scaling value x0.2').className).toContain('valueWrapVisible')

    rerender(<WeaponPanel weaponStats={weaponStats} isEditable />)

    expect(screen.getByRole('button', { name: 'Edit Bullet Damage scaling' })).toBeInTheDocument()
  })
})

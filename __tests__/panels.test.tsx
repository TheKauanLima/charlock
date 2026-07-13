// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsBoonPanel from '@/components/panels/hero-stats-boon-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import WeaponPanel from '@/components/panels/weapon-panel'
import { buildBoonStatsArray } from '@/components/panels/boon-stats-mapper'
import { buildSpiritPowerStat } from '@/components/panels/spirit-stats-mapper'
import { buildVitalityStatsArray, normalizeVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import { buildPelletCountStat, buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'

afterEach(() => {
  cleanup()
})

describe('hero stat mappers', () => {
  it('stores every boon reward as an explicit boon scaling value', () => {
    const stats = buildBoonStatsArray()

    expect(stats).toHaveLength(4)
    expect(stats.every(stat => stat.scaling === 'boon' && stat.scalingValue === String(stat.value))).toBe(true)
  })

  it('preserves custom boon reward rows after the default rewards', () => {
    const stats = buildBoonStatsArray([
      { label: 'Base Health', value: '120', unit: '', icon: 'health', scaling: 'boon', scalingValue: '120' },
      { label: 'Air Control', value: '9', unit: '', icon: 'damage_magic_color', scaling: 'boon', scalingValue: '9' },
    ])

    expect(stats).toHaveLength(5)
    expect(stats[3]).toMatchObject({ label: 'Base Health', value: '120', scalingValue: '120' })
    expect(stats[4]).toMatchObject({ label: 'Air Control', value: '9', scaling: 'boon', scalingValue: '9' })
  })

  it('preserves edited default boon reward labels and icons by position', () => {
    const stats = buildBoonStatsArray([
      { label: 'Bullet Bonus', value: '0.5', unit: '', icon: '/panorama/images/icons/properties/heal.svg', scaling: 'boon', scalingValue: '0.5' },
      { label: 'Melee Bonus', value: '2', unit: '', icon: 'damage_melee_color', scaling: 'boon', scalingValue: '2' },
      { label: 'Spirit Bonus', value: '3', unit: '', icon: 'damage_magic_color', scaling: 'boon', scalingValue: '3' },
      { label: 'Health Bonus', value: '40', unit: '', icon: 'health', scaling: 'boon', scalingValue: '40' },
      { label: 'Air Control', value: '9', unit: '', icon: 'damage_magic_color', scaling: 'boon', scalingValue: '9' },
    ])

    expect(stats).toHaveLength(5)
    expect(stats[0]).toMatchObject({ label: 'Bullet Bonus', value: '0.5', icon: '/panorama/images/icons/properties/heal.svg' })
    expect(stats[1]).toMatchObject({ label: 'Melee Bonus', value: '2' })
    expect(stats[2]).toMatchObject({ label: 'Spirit Bonus', value: '3' })
    expect(stats[3]).toMatchObject({ label: 'Health Bonus', value: '40' })
    expect(stats[4]).toMatchObject({ label: 'Air Control', value: '9' })
  })

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
    expect(buildVitalityStatsArray()[4]).toMatchObject({ label: 'Lifesteal Effectiveness', value: '0', unit: '%', icon: 'lifestealEffectiveness' })
    expect(buildSpiritPowerStat()).toMatchObject({ label: 'Spirit Power', value: '0', description: expect.stringContaining('Spirit Power') })
  })
})

describe('migrated stat panels', () => {
  it('renders and edits the four boon rewards', async () => {
    let changedValue = ''
    let changedScaling = ''
    let changedScalingValue = ''

    render(<HeroStatsBoonPanel heroName="Victor" isEditable onStatsChange={stats => {
      changedValue = String(stats[0].value)
      changedScaling = stats[0].scaling
      changedScalingValue = stats[0].scalingValue
    }} />)

    expect(screen.getByRole('heading', { name: 'Boon Rewards' })).toBeInTheDocument()
    expect(screen.getByText('At each threshold, Victor gains:')).toBeInTheDocument()
    expect(screen.getByText('Abilities unlock at Boons 0, 2, 4 and 6')).toBeInTheDocument()
    expect(screen.getByTestId('boon-unlock-icon')).toBeInTheDocument()
    expect(screen.getByTestId('boon-ap-icon')).toBeInTheDocument()
    expect(screen.getByTestId('boon-base-health-icon')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/value$/)).toHaveLength(4)
    expect(screen.getByLabelText('Boon stat 1 label')).toHaveValue('Base Bullet Damage')
    expect(screen.getByRole('button', { name: 'Change Base Bullet Damage icon' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Base Bullet Damage' })).not.toBeInTheDocument()

    const boonStyles = readFileSync('components/panels/HeroStatsBoonPanel.module.css', 'utf8')
    expect(boonStyles).toMatch(/\.header\s*\{[^}]*background:\s*#11130e/)
    expect(boonStyles).not.toMatch(/\.header\s*\{[^}]*gradient/)
    expect(boonStyles).not.toMatch(/\.unlockIcon\s*\{[^}]*mask:/)
    expect(boonStyles).toMatch(/\.apIcon\s*\{[^}]*background:\s*#e6cafc/)
    expect(boonStyles).toMatch(/\.healthIcon\s*\{[^}]*background:\s*#01fe9c/)
    expect(boonStyles).toMatch(/\.iconPickerBackdrop\s*\{[^}]*background:\s*transparent/)
    expect(boonStyles).toMatch(/\.iconPicker\s*\{[^}]*position:\s*absolute/)
    expect(boonStyles).toMatch(/\.iconPickerDefault button\s*\{/)
    expect(boonStyles).toMatch(/\.iconPickerGrid button span\s*\{[^}]*background-size:\s*contain/)
    expect(boonStyles).not.toMatch(/\.iconPickerGrid button span\s*\{[^}]*mask-position/)

    const unlockIcon = readFileSync('public/panorama/images/hud/unlock_icon.svg', 'utf8')
    expect(unlockIcon).toContain('path[fill="white"] { fill: #e6cafc; }')
    expect(unlockIcon).toContain('fill="#1A1A1A"')

    const bulletDamage = screen.getByLabelText('Base Bullet Damage value')
    fireEvent.change(bulletDamage, { target: { value: '0.42' } })
    expect(changedValue).toBe('0.42')
    expect(changedScaling).toBe('boon')
    expect(changedScalingValue).toBe('0.42')
  })

  it('renames, changes icons, and edits default and custom boon rewards', async () => {
    const user = userEvent.setup()
    let latestStats = buildBoonStatsArray()
    const handleStatsChange = (stats: typeof latestStats) => {
      latestStats = stats
      panel.rerender(<HeroStatsBoonPanel heroName="Victor" isEditable stats={latestStats} onStatsChange={handleStatsChange} />)
    }
    const panel = render(<HeroStatsBoonPanel heroName="Victor" isEditable stats={latestStats} onStatsChange={handleStatsChange} />)

    await user.clear(screen.getByLabelText('Boon stat 1 label'))
    await user.type(screen.getByLabelText('Boon stat 1 label'), 'Bullet Bonus')
    await user.click(screen.getByRole('button', { name: 'Change Bullet Bonus icon' }))
    let iconModal = screen.getByTestId('boon-stat-icon-modal')
    const nativeSpiritIcon = within(iconModal).getByRole('button', { name: 'Use Spirit' }).querySelector('[aria-hidden="true"]')

    expect(within(iconModal).getByRole('button', { name: 'Use Default Icon' })).toHaveTextContent('Native colors')
    expect(nativeSpiritIcon?.getAttribute('style')).toContain('background-image')
    expect(nativeSpiritIcon?.getAttribute('style')).not.toContain('mask')

    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))

    expect(latestStats[0]).toMatchObject({ label: 'Bullet Bonus', icon: '/panorama/images/icons/properties/heal.svg' })
    expect(screen.queryByRole('button', { name: 'Remove Bullet Bonus' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Boon Stat' }))

    expect(screen.getByLabelText('Extra Stat value')).toHaveValue('0')
    expect(screen.getByLabelText('Boon stat 5 label')).toHaveValue('Extra Stat')

    await user.clear(screen.getByLabelText('Boon stat 5 label'))
    await user.type(screen.getByLabelText('Boon stat 5 label'), 'Air Control')
    await user.clear(screen.getByLabelText('Air Control value'))
    await user.type(screen.getByLabelText('Air Control value'), '9')

    expect(latestStats[4]).toMatchObject({ label: 'Air Control', value: '9', scaling: 'boon', scalingValue: '9' })

    await user.click(screen.getByRole('button', { name: 'Change Air Control icon' }))

    iconModal = screen.getByTestId('boon-stat-icon-modal')

    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))

    expect(latestStats[4]).toMatchObject({ icon: '/panorama/images/icons/properties/heal.svg' })
    expect(screen.queryByTestId('boon-stat-icon-modal')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Air Control' }))

    expect(latestStats).toHaveLength(4)
    expect(screen.queryByLabelText('Air Control value')).not.toBeInTheDocument()
  })

  it('raises any panel row that contains an open scaling menu', () => {
    const stylesheets = [
      'components/panels/HeroStatsVitalityPanel.module.css',
      'components/panels/HeroStatsSpiritPanel.module.css',
      'components/panels/WeaponPanel.module.css',
    ].map(path => readFileSync(path, 'utf8'))

    for (const stylesheet of stylesheets) {
      expect(stylesheet).toMatch(/:has\(\[data-scaling-picker-menu\]\)[^{]*\{[^}]*z-index:\s*10000/)
    }
  })

  it('repairs legacy vitality arrays without promoting Move Speed into the top section', () => {
    const legacyStats = buildVitalityStatsArray().filter(stat => stat.label !== 'Lifesteal Effectiveness')
    const normalizedStats = normalizeVitalityStatsArray(legacyStats)

    expect(normalizedStats).toHaveLength(16)
    expect(normalizedStats[4]).toMatchObject({ label: 'Lifesteal Effectiveness', value: '0', unit: '%' })
    expect(normalizedStats[10]).toMatchObject({ label: 'Move Speed' })

    render(<HeroStatsVitalityPanel stats={legacyStats} />)

    const lifestealCell = screen.getByRole('button', { name: 'Lifesteal Effectiveness: 0%' })
    const moveSpeedCell = screen.getByRole('button', { name: /Move Speed/ })
    expect(lifestealCell.parentElement?.parentElement?.className).toContain('topStats')
    expect(moveSpeedCell.parentElement?.parentElement?.className).toContain('bottomStats')
  })

  it('renders vitality and spirit defaults', () => {
    render(
      <>
        <HeroStatsVitalityPanel />
        <HeroStatsSpiritPanel />
      </>,
    )

    expect(screen.getByTestId('hero-stats-vitality-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Max Health: 810/ })).toBeInTheDocument()
    const lifestealCell = screen.getByRole('button', { name: 'Lifesteal Effectiveness: 0%' })
    expect(lifestealCell.parentElement?.parentElement?.className).toContain('topStats')
    expect(within(lifestealCell).getByText('Lifesteal Effectiveness').parentElement?.previousElementSibling).toHaveStyle({ maskImage: "url('/panorama/images/icons/properties/health_steal.svg')" })
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

    const damageTypeButton = within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Bullet)' })

    await user.click(damageTypeButton)
    expect(within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Magic)' })).toBeInTheDocument()
    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Magic)' }))
    expect(within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Melee)' })).toBeInTheDocument()
    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Melee)' }))
    expect(within(bulletDamageCell).getByRole('button', { name: 'Change Bullet Damage type (Bullet)' })).toBeInTheDocument()

    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Edit Bullet Damage scaling' }))
    expect(screen.getByRole('dialog', { name: 'Bullet Damage scaling controls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set Bullet Damage scaling to gun' })).toHaveTextContent('Gun')
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

  it('enables pellet count only for shotgun weapons', async () => {
    const user = userEvent.setup()
    const weaponStats = buildWeaponStatsArray()
    const { rerender } = render(<WeaponPanel isEditable weaponStats={weaponStats} />)

    const shotgunToggle = screen.getByLabelText('Shotgun Pellets')

    expect(shotgunToggle).not.toBeChecked()
    expect(screen.queryByLabelText('Pellet Count value')).not.toBeInTheDocument()

    await user.click(shotgunToggle)

    const pelletInput = screen.getByLabelText('Pellet Count value')

    expect(pelletInput).toHaveValue('1')
    await user.clear(pelletInput)
    await user.type(pelletInput, '6')
    expect(pelletInput).toHaveValue('6')

    await user.click(shotgunToggle)
    expect(screen.queryByLabelText('Pellet Count value')).not.toBeInTheDocument()

    rerender(<WeaponPanel weaponStats={[...weaponStats, buildPelletCountStat(8)]} />)

    expect(screen.getByRole('button', { name: 'Pellet Count: 8' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Shotgun Pellets')).not.toBeInTheDocument()
  })

  it('opens bottom weapon and spirit scaling menus above their buttons', async () => {
    const user = userEvent.setup()

    render(
      <>
        <WeaponPanel isEditable />
        <HeroStatsSpiritPanel isEditable />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Edit Heavy Melee scaling' }))
    expect(screen.getByRole('dialog', { name: 'Heavy Melee scaling controls' }).parentElement).toHaveAttribute('data-menu-position', 'above')

    await user.click(screen.getByRole('button', { name: 'Edit Spirit Power scaling' }))
    expect(screen.getByRole('dialog', { name: 'Spirit Power scaling controls' }).parentElement).toHaveAttribute('data-menu-position', 'above')
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
    expect(screen.queryByRole('button', { name: 'Set Max Health scaling to boon' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set Max Health scaling to spirit' }))
    expect(maxHealthCell).toHaveAttribute('data-scaling', 'spirit')
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

  it('does not expose or display legacy boon scaling in ordinary stat panels', async () => {
    const user = userEvent.setup()
    const legacyStats = [
      { label: 'Bullet Damage', value: '13.5', unit: '', icon: 'bulletDamage', scaling: 'boon' as const, scalingValue: '0.12' },
    ]

    render(<WeaponPanel weaponStats={legacyStats} isEditable showDetails />)

    const bulletDamageCell = screen.getByRole('group', { name: /Bullet Damage/ })
    expect(bulletDamageCell).toHaveAttribute('data-scaling', 'none')
    expect(screen.queryByLabelText('boon scaling value x0.12')).not.toBeInTheDocument()

    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Edit Bullet Damage scaling' }))
    expect(screen.queryByRole('button', { name: 'Set Bullet Damage scaling to boon' })).not.toBeInTheDocument()
  })
})

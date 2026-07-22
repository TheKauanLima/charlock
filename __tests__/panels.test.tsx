// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { useState } from 'react'
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
    expect(buildVitalityStatsArray()[16]).toMatchObject({ label: 'Air Control', value: '0', unit: '%', icon: 'stamina' })
    expect(buildVitalityStatsArray()[17]).toMatchObject({ label: 'Gravity Scale', value: '0', unit: '%', icon: 'stamina' })
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
    expect(boonStyles).toMatch(/\.iconPickerBackdrop\s*\{[^}]*place-items:\s*center/)
    expect(boonStyles).toMatch(/\.iconPickerBackdrop\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.52\)/)
    expect(boonStyles).toMatch(/\.iconPicker\s*\{[^}]*width:\s*min\(760px,\s*calc\(100vw - 44px\)\)/)
    expect(boonStyles).toMatch(/\.iconColorPicker\s*\{/)
    expect(boonStyles).toMatch(/\.squareIconPicker\s*\{/)
    expect(boonStyles).toMatch(/\.squareIconSelect\s*\{/)
    expect(boonStyles).toMatch(/\.iconSizePicker\s*\{/)
    expect(boonStyles).toMatch(/\.iconPickerDefault button\s*\{/)
    expect(boonStyles).toMatch(/\.iconPickerGrid button\s*\{[^}]*grid-template-columns:\s*26px minmax\(0,\s*1fr\)/)
    expect(boonStyles).toMatch(/\.iconPickerGrid button span\s*\{[^}]*width:\s*24px/)
    expect(boonStyles).not.toMatch(/--icon-preview-size/)
    expect(boonStyles).toMatch(/\.iconPickerGrid button span\s*\{[^}]*background-size:\s*contain/)
    expect(boonStyles).toMatch(/\.iconPickerGrid button span\s*\{[^}]*mask-position:\s*center/)

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
    const nativeDamageIcon = within(iconModal).getByRole('button', { name: 'Use Damage Bullet Color' }).querySelector('[aria-hidden="true"]')

    expect(within(iconModal).getByRole('button', { name: 'Use Default Icon' })).toHaveTextContent('Native colors')
    expect(within(iconModal).getByRole('button', { name: 'Default icon color' })).toHaveAttribute('aria-pressed', 'true')
    expect(nativeDamageIcon?.getAttribute('style')).toContain('background-image')
    expect(nativeDamageIcon?.getAttribute('style')).not.toContain('mask')
    expect(within(iconModal).getByRole('button', { name: 'Use Square Icon' })).toBeInTheDocument()
    expect(within(iconModal).getByRole('button', { name: 'Medium square icon size' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(iconModal).getByRole('button', { name: 'Tiny square icon size' }))

    expect(within(iconModal).getByRole('button', { name: 'Tiny square icon size' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(iconModal).getByRole('button', { name: 'Use Spirit' })).not.toHaveAttribute('style')

    await user.click(within(iconModal).getByRole('button', { name: 'Spirit icon color' }))
    expect(within(iconModal).getByRole('button', { name: 'Spirit icon color' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(iconModal).getByRole('button', { name: 'Large square icon size' }))
    await user.click(within(iconModal).getByRole('button', { name: 'Use Square Icon' }))

    expect(latestStats[0]).toMatchObject({ label: 'Bullet Bonus', icon: 'square:large', iconColor: '#7e61a1' })
    expect(screen.getByRole('button', { name: 'Change Bullet Bonus icon' }).querySelector('[aria-hidden="true"]')).toHaveAttribute(
      'style',
      expect.stringContaining('width: 22px'),
    )

    await user.click(screen.getByRole('button', { name: 'Change Bullet Bonus icon' }))
    iconModal = screen.getByTestId('boon-stat-icon-modal')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Spirit' }))

    expect(latestStats[0]).toMatchObject({ label: 'Bullet Bonus', icon: '/panorama/images/icons/properties/spirit.svg', iconColor: '#7e61a1' })
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

    expect(normalizedStats).toHaveLength(18)
    expect(normalizedStats[4]).toMatchObject({ label: 'Lifesteal Effectiveness', value: '0', unit: '%' })
    expect(normalizedStats[10]).toMatchObject({ label: 'Move Speed' })
    expect(normalizedStats[16]).toMatchObject({ label: 'Air Control', value: '0', unit: '%', icon: 'stamina' })
    expect(normalizedStats[17]).toMatchObject({ label: 'Gravity Scale', value: '0', unit: '%', icon: 'stamina' })

    render(<HeroStatsVitalityPanel stats={legacyStats} />)

    const lifestealCell = screen.getByRole('button', { name: 'Lifesteal Effectiveness: 0%' })
    const moveSpeedCell = screen.getByRole('button', { name: /Move Speed/ })
    const airControlCell = screen.getByRole('button', { name: 'Air Control: 0%' })
    const gravityScaleCell = screen.getByRole('button', { name: 'Gravity Scale: 0%' })
    expect(lifestealCell.parentElement?.parentElement?.className).toContain('topStats')
    expect(moveSpeedCell.parentElement?.parentElement?.className).toContain('bottomStats')
    expect(airControlCell.parentElement?.parentElement?.className).toContain('bottomStats')
    expect(gravityScaleCell.parentElement?.parentElement?.className).toContain('bottomStats')
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
    const airControlCell = screen.getByRole('button', { name: 'Air Control: 0%' })
    const gravityScaleCell = screen.getByRole('button', { name: 'Gravity Scale: 0%' })
    expect(lifestealCell.parentElement?.parentElement?.className).toContain('topStats')
    expect(within(lifestealCell).getByText('Lifesteal Effectiveness').parentElement?.previousElementSibling).toHaveStyle({ maskImage: "url('/panorama/images/icons/properties/health_steal.svg')" })
    expect(airControlCell.parentElement?.parentElement?.className).toContain('bottomStats')
    expect(gravityScaleCell.parentElement?.parentElement?.className).toContain('bottomStats')
    expect(within(airControlCell).getByText('Air Control').parentElement?.previousElementSibling).toHaveStyle({ maskImage: "url('/panorama/images/icons/properties/move_stamina.svg')" })
    expect(within(gravityScaleCell).getByText('Gravity Scale').parentElement?.previousElementSibling).toHaveStyle({ maskImage: "url('/panorama/images/icons/properties/move_stamina.svg')" })
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
    expect(screen.getByRole('button', { name: 'Set Max Health scaling to boon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set Max Health scaling to other' })).toBeInTheDocument()
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

  it('edits custom scaling metadata from the shared scaling dropdown', async () => {
    const user = userEvent.setup()
    let latestStats = [
      { label: 'Bullet Damage', value: '13.5', unit: '', icon: 'bulletDamage', scaling: 'none' as const, scalingValue: '0' },
    ]

    function WeaponPanelHarness() {
      const [stats, setStats] = useState(latestStats)

      latestStats = stats

      return <WeaponPanel weaponStats={stats} isEditable showDetails onStatsChange={setStats} />
    }

    render(<WeaponPanelHarness />)

    const bulletDamageCell = screen.getByRole('group', { name: /Bullet Damage/ })

    await user.click(within(bulletDamageCell).getByRole('button', { name: 'Edit Bullet Damage scaling' }))
    await user.click(screen.getByRole('button', { name: 'Set Bullet Damage scaling to other' }))
    expect(bulletDamageCell).toHaveAttribute('data-scaling', 'custom')
    expect(latestStats[0]).toMatchObject({
      scaling: 'custom',
      customScaling: {
        name: 'Other',
        icon: '/panorama/images/icons/properties/spirit.svg',
        color: '#f5eadb',
      },
    })

    const nameInput = screen.getByLabelText('Bullet Damage custom scaling name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Curse')
    expect(latestStats[0].customScaling?.name).toBe('Curse')

    fireEvent.change(screen.getByLabelText('Bullet Damage custom scaling color'), { target: { value: '#84c955' } })
    expect(latestStats[0].customScaling?.color).toBe('#84c955')

    await user.click(screen.getByRole('button', { name: 'Bullet Damage custom scaling icon' }))
    const iconDialog = screen.getByRole('dialog', { name: 'Bullet Damage custom scaling icon selector' })
    expect(iconDialog).toBeInTheDocument()
    expect(iconDialog.parentElement).toBe(document.body)
    expect(screen.getByRole('tablist', { name: 'Ability icon categories' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Stat icons' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use Abrams 1' }))
    expect(latestStats[0].customScaling?.icon).toBe('/panorama/images/hud/abilities/abrams/1.png')
  })
})

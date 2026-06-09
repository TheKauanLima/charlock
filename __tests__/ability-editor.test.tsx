// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { HEROES } from '@/lib/hero-data'

afterEach(() => {
  cleanup()
})

describe('AbilityEditor', () => {
  it('manages focused ability state and saves a scaled rich-text payload', async () => {
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

    expect(screen.getByTestId('ability-editor')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Ability Name'))
    await user.type(screen.getByLabelText('Ability Name'), 'Kinetic Fault')

    const cooldownScalingButton = screen.getAllByRole('button', { name: 'none' })[0]

    expect(cooldownScalingButton).toHaveAttribute('data-scaling', 'none')
    await user.click(cooldownScalingButton)
    expect(cooldownScalingButton).toHaveAttribute('data-scaling', 'spirit')

    await user.click(screen.getByLabelText('Charges'))
    expect(screen.getAllByText('Recharge Time').length).toBeGreaterThan(0)

    await user.click(screen.getByLabelText('Add sub-header stat'))
    expect(screen.getAllByDisplayValue('Stat')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Insert bold text' }))
    await user.click(screen.getByRole('button', { name: 'Inline Icon' }))

    const iconModal = screen.getByTestId('property-icon-modal')

    await user.type(within(iconModal).getByPlaceholderText('Search property icons'), 'heal')
    await user.click(within(iconModal).getByRole('button', { name: 'Use Heal' }))

    expect((screen.getByDisplayValue(/channels custom ability/) as HTMLTextAreaElement).value).toContain('[i:heal]')

    await user.click(screen.getByRole('button', { name: 'Save & Return' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Kinetic Fault',
      hasCharges: true,
      cooldown: expect.objectContaining({
        scaling: 'spirit',
      }),
      subStats: expect.arrayContaining([
        expect.objectContaining({
          label: 'Stat',
        }),
      ]),
      sections: expect.arrayContaining([
        expect.objectContaining({
          type: 'richText',
          text: expect.stringContaining('[i:heal]'),
        }),
      ]),
    }))
  })
})

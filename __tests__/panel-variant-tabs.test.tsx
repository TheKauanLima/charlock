// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import PanelVariantTabs, { BASE_PANEL_ID } from '@/components/PanelVariantTabs/PanelVariantTabs'

describe('panel variant tab colors', () => {
  it('identifies each stat category and gives its controls a solid panel-colored background', () => {
    const { rerender } = render(<PanelVariantTabs baseName="Weapon" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)

    expect(screen.getByRole('tablist', { name: 'Weapon panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'weapon')

    rerender(<PanelVariantTabs baseName="Vitality" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)
    expect(screen.getByRole('tablist', { name: 'Vitality panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'vitality')

    rerender(<PanelVariantTabs baseName="Spirit" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)
    expect(screen.getByRole('tablist', { name: 'Spirit panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'spirit')

    rerender(<PanelVariantTabs baseName="Boon" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)
    expect(screen.getByRole('tablist', { name: 'Boon panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'boon')

    const stylesheet = readFileSync('components/PanelVariantTabs/PanelVariantTabs.module.css', 'utf8')
    expect(stylesheet).toMatch(/data-panel-kind='weapon'[\s\S]*--panel-tab-color:\s*#8a571f/)
    expect(stylesheet).toMatch(/data-panel-kind='vitality'[\s\S]*--panel-tab-color:\s*#355c2f/)
    expect(stylesheet).toMatch(/data-panel-kind='spirit'[\s\S]*--panel-tab-color:\s*#68446f/)
    expect(stylesheet).toMatch(/data-panel-kind='boon'[\s\S]*--panel-tab-color:\s*#5a4770/)
    expect(stylesheet).toMatch(/background:\s*var\(--panel-tab-color\)/)
  })

  it('places an X removal control at the top-left of only the active additional tab', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const variants = [{ id: 'weapon-alt', name: 'Shotgun' }]
    const { rerender } = render(
      <PanelVariantTabs baseName="Weapon" variants={variants} activeId={BASE_PANEL_ID} canRemove onSelect={() => undefined} onRemove={onRemove} />,
    )

    expect(screen.queryByRole('button', { name: 'Remove active Weapon panel' })).not.toBeInTheDocument()

    rerender(<PanelVariantTabs baseName="Weapon" variants={variants} activeId="weapon-alt" canRemove onSelect={() => undefined} onRemove={onRemove} />)
    const removeButton = screen.getByRole('button', { name: 'Remove active Weapon panel' })

    expect(removeButton).toHaveTextContent('×')
    expect(removeButton.parentElement).toContainElement(screen.getByRole('tab', { name: 'Shotgun' }))
    await user.click(removeButton)

    expect(onRemove).toHaveBeenCalledWith('weapon-alt')

    const stylesheet = readFileSync('components/PanelVariantTabs/PanelVariantTabs.module.css', 'utf8')
    expect(stylesheet).toMatch(/\.removeButton\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*2px;[\s\S]*left:\s*3px;/)
    expect(stylesheet).toMatch(/\.removeButton\s*\{[\s\S]*background:\s*transparent;/)
  })
})

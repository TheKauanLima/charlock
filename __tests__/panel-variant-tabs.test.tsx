// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PanelVariantTabs, { BASE_PANEL_ID } from '@/components/PanelVariantTabs/PanelVariantTabs'

describe('panel variant tab colors', () => {
  it('identifies each stat category and gives its controls a solid panel-colored background', () => {
    const { rerender } = render(<PanelVariantTabs baseName="Weapon" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)

    expect(screen.getByRole('tablist', { name: 'Weapon panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'weapon')

    rerender(<PanelVariantTabs baseName="Vitality" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)
    expect(screen.getByRole('tablist', { name: 'Vitality panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'vitality')

    rerender(<PanelVariantTabs baseName="Spirit" activeId={BASE_PANEL_ID} onSelect={() => undefined} />)
    expect(screen.getByRole('tablist', { name: 'Spirit panel variants' }).parentElement).toHaveAttribute('data-panel-kind', 'spirit')

    const stylesheet = readFileSync('components/PanelVariantTabs/PanelVariantTabs.module.css', 'utf8')
    expect(stylesheet).toMatch(/data-panel-kind='weapon'[\s\S]*--panel-tab-color:\s*#8a571f/)
    expect(stylesheet).toMatch(/data-panel-kind='vitality'[\s\S]*--panel-tab-color:\s*#355c2f/)
    expect(stylesheet).toMatch(/data-panel-kind='spirit'[\s\S]*--panel-tab-color:\s*#68446f/)
    expect(stylesheet).toMatch(/background:\s*var\(--panel-tab-color\)/)
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'

afterEach(() => {
  cleanup()
})

describe('SidebarTabs', () => {
  it('uses shop key stat icons for stat tabs', () => {
    render(<SidebarTabs activeTabId="overview" onSelect={() => undefined} />)

    const expectedIcons = [
      ['Weapon stats', 'keystat_courage_png.png'],
      ['Vitality stats', 'keystat_fortitude_png.png'],
      ['Spirit stats', 'keystat_spirit_png.png'],
    ] as const

    for (const [label, fileName] of expectedIcons) {
      const icon = screen.getByRole('tab', { name: label }).querySelector('[aria-hidden="true"]')

      expect(icon).toHaveAttribute('style', expect.stringContaining(`/panorama/images/shop/${fileName}`))
    }
  })
})

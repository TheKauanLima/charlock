// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'

afterEach(() => {
  cleanup()
})

describe('SidebarTabs', () => {
  it('uses tintable HUD core icons for stat tabs', () => {
    render(<SidebarTabs activeTabId="overview" onSelect={() => undefined} />)

    const expectedIcons = [
      ['Weapon stats', 'icon_courage.svg'],
      ['Vitality stats', 'icon_fortitude.svg'],
      ['Spirit stats', 'icon_spirit.svg'],
    ] as const

    for (const [label, fileName] of expectedIcons) {
      const icon = screen.getByRole('tab', { name: label }).querySelector('[aria-hidden="true"]')

      expect(icon).toHaveAttribute('style', expect.stringContaining(`/panorama/images/hud/core/${fileName}`))
    }

    const stylesheet = readFileSync('components/SidebarTabs/SidebarTabs.module.css', 'utf8')
    const imageRule = stylesheet.match(/\.iconImage\s*\{([^}]*)\}/)?.[1]
    const inactiveRule = stylesheet.match(/\.iconInactive\s*\{([^}]*)\}/)?.[1]
    const hoverRule = stylesheet.match(/\.tabButtonInactive:hover \.icon\s*\{([^}]*)\}/)?.[1]

    expect(imageRule).toMatch(/background-color:\s*currentColor/)
    expect(inactiveRule).toMatch(/color:\s*rgb\(0 0 0 \/ 45%\)/)
    expect(hoverRule).toMatch(/color:\s*#000/)
  })
})

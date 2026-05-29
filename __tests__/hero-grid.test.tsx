// @vitest-environment jsdom

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HeroGrid from '@/components/hero-grid'

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
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('src', expect.stringContaining('/panorama/images/heroes/hero_names/abrams.svg'))

    await user.click(screen.getByRole('button', { name: 'Select hero Grey Talon' }))

    expect(await screen.findByRole('img', { name: 'Grey Talon render' })).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-cluster')).toHaveAttribute('data-hero-slug', 'greytalon')
    expect(screen.getByTestId('hero-info-name-image')).toHaveAttribute('src', expect.stringContaining('/panorama/images/heroes/hero_names/grey_talon.svg'))
  })
})
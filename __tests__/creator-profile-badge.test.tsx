// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CreatorProfileBadge from '@/components/CreatorProfileBadge/CreatorProfileBadge'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.unoptimized

    return React.createElement('img', imageProps)
  },
}))

afterEach(cleanup)

describe('CreatorProfileBadge', () => {
  it('links the avatar, username, level, and action to the encoded public profile route', () => {
    render(<CreatorProfileBadge creator={{
      userId: 'user_creator_1',
      username: 'Rift Smith',
      profileSlug: 'Rift Smith/Builds',
      avatarUrl: 'https://example.com/rift-smith.png',
      level: 'Community Leader',
      preferredHero: 'haze',
    }} />)

    const link = screen.getByRole('link', { name: 'View Rift Smith profile' })

    expect(link).toHaveAttribute('href', '/profile/Rift%20Smith%2FBuilds')
    expect(link).toHaveTextContent('Rift Smith')
    expect(link).toHaveTextContent('Community Leader')
    expect(link).toHaveTextContent('View Creator Profile')
    expect(link.querySelector('img')).toHaveAttribute('src', 'https://example.com/rift-smith.png')
  })

  it('renders initials without an avatar and a non-link official roster fallback', () => {
    const { rerender } = render(<CreatorProfileBadge creator={{
      userId: 'user_creator_2',
      username: 'Night Weaver',
      profileSlug: 'night_weaver',
      level: 'Contributor',
    }} compact />)

    expect(screen.getByRole('link', { name: 'View Night Weaver profile' })).toHaveTextContent('NW')
    expect(screen.getByText('Profile')).toBeInTheDocument()

    rerender(<CreatorProfileBadge official />)

    expect(screen.getByText('Official Roster')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders an accessible avatar-only profile action for the hero social row', () => {
    render(<CreatorProfileBadge creator={{
      userId: 'user_creator_3',
      username: 'Rift Smith',
      profileSlug: 'rift_smith',
      avatarUrl: 'https://example.com/rift-smith.png',
      level: 'Power User',
    }} iconOnly />)

    const link = screen.getByRole('link', { name: 'View Rift Smith profile' })

    expect(link).toHaveAttribute('href', '/profile/rift_smith')
    expect(link).toHaveAttribute('title', 'View Rift Smith profile')
    expect(link).not.toHaveTextContent('Rift Smith')
    expect(link.querySelector('img')).toHaveAttribute('src', 'https://example.com/rift-smith.png')
  })
})

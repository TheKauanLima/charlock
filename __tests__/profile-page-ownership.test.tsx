// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from '@/app/profile/[username]/page'

const profileMocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
}))

vi.mock('@/lib/profile', () => ({
  getUserProfile: profileMocks.getUserProfile,
  isProfilePrivateError: () => false,
  isProfileUnavailableError: () => false,
}))

vi.mock('@/components/UserProfile/PublicUserProfile', () => ({
  default: () => <div data-testid="public-profile-page">Public profile</div>,
}))

vi.mock('@/components/UserProfile/UserProfile', () => ({
  default: () => <div data-testid="owner-profile-page">Owner profile</div>,
}))

afterEach(() => {
  cleanup()
  profileMocks.getUserProfile.mockReset()
})

describe('/profile/[username] ownership routing', () => {
  it('renders the dedicated public page for another user', async () => {
    profileMocks.getUserProfile.mockResolvedValue({ viewerIsOwner: false })

    render(await ProfilePage({ params: Promise.resolve({ username: 'rift_smith' }) }))

    expect(screen.getByTestId('public-profile-page')).toBeInTheDocument()
    expect(screen.queryByTestId('owner-profile-page')).not.toBeInTheDocument()
  })

  it('retains the full profile workspace for the owner', async () => {
    profileMocks.getUserProfile.mockResolvedValue({ viewerIsOwner: true })

    render(await ProfilePage({ params: Promise.resolve({ username: 'owner' }) }))

    expect(screen.getByTestId('owner-profile-page')).toBeInTheDocument()
    expect(screen.queryByTestId('public-profile-page')).not.toBeInTheDocument()
  })
})

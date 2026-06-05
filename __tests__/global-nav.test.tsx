// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerkMocks = vi.hoisted(() => ({
  useUserMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: clerkMocks.useUserMock,
  useClerk: () => ({
    signOut: clerkMocks.signOutMock,
  }),
}))

import GlobalNav from '@/components/GlobalNav/GlobalNav'

beforeEach(() => {
  clerkMocks.useUserMock.mockReset()
  clerkMocks.signOutMock.mockReset()
  clerkMocks.signOutMock.mockResolvedValue(undefined)
})

describe('GlobalNav', () => {
  it('renders no avatar for signed-out visitors', () => {
    clerkMocks.useUserMock.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    })

    render(<GlobalNav />)

    expect(screen.queryByLabelText('Open profile navigation')).not.toBeInTheDocument()
  })

  it('opens dossier actions for signed-in users and signs out', async () => {
    const user = userEvent.setup()

    clerkMocks.useUserMock.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'clerk_123',
        username: null,
        unsafeMetadata: {
          username: 'metadata_user',
        },
        fullName: null,
        imageUrl: '',
        primaryEmailAddress: {
          emailAddress: 'player@example.com',
        },
      },
    })

    render(<GlobalNav />)
    await user.click(screen.getByLabelText('Open profile navigation'))

    expect(screen.getByRole('menuitem', { name: /view dossier/i })).toHaveAttribute('href', '/profile/metadata_user')
    expect(screen.getByRole('menuitem', { name: /settings/i })).toHaveAttribute('href', '/profile/settings')

    await user.click(screen.getByRole('menuitem', { name: /leave precinct/i }))

    expect(clerkMocks.signOutMock).toHaveBeenCalledWith({ redirectUrl: '/sign-in' })
  })
})

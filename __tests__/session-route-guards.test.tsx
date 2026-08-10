// @vitest-environment jsdom

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}))
const replaceMock = vi.hoisted(() => vi.fn())
const heroGridMock = vi.hoisted(() => vi.fn(() => <div data-testid="hero-grid" />))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => clerkState,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

vi.mock('@/components/HeroGrid/HeroGrid', () => ({
  default: heroGridMock,
}))

import AuthenticatedHome from '@/components/auth/AuthenticatedHome'
import GuestOnlyAuth from '@/components/auth/GuestOnlyAuth'

beforeEach(() => {
  clerkState.isLoaded = true
  clerkState.isSignedIn = false
  replaceMock.mockReset()
  heroGridMock.mockClear()
})

describe('live Clerk route guards', () => {
  it('renders guest auth content only after Clerk confirms the user is signed out', () => {
    render(<GuestOnlyAuth><div>Sign up form</div></GuestOnlyAuth>)

    expect(screen.getByText('Sign up form')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('removes stale guest auth content and returns signed-in users home', async () => {
    clerkState.isSignedIn = true

    render(<GuestOnlyAuth><div>Sign up form</div></GuestOnlyAuth>)

    expect(screen.queryByText('Sign up form')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Returning' })).toBeInTheDocument()
    expect(screen.getByText('Opening your account...')).toBeInTheDocument()
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
  })

  it('renders the application when the server fallback meets a live signed-in session', () => {
    clerkState.isSignedIn = true

    render(<AuthenticatedHome initialTab="Browse" initialHeroId="hero_123" />)

    expect(screen.getByTestId('hero-grid')).toBeInTheDocument()
    expect(heroGridMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialTab: 'Browse', initialHeroId: 'hero_123' }),
      undefined,
    )
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('sends confirmed signed-out visitors to account creation', async () => {
    render(<AuthenticatedHome initialTab="Select" />)

    expect(screen.queryByTestId('hero-grid')).not.toBeInTheDocument()
    expect(screen.getByText('Opening account creation...')).toBeInTheDocument()
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/sign-up'))
  })
})

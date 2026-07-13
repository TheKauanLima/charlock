// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInMocks = vi.hoisted(() => ({
  create: vi.fn(),
  password: vi.fn(),
  finalize: vi.fn(),
  authenticateWithRedirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({
    client: {
      signIn: {
        authenticateWithRedirect: signInMocks.authenticateWithRedirect,
      },
    },
  }),
  useSignIn: () => ({
    signIn: {
      create: signInMocks.create,
      password: signInMocks.password,
      finalize: signInMocks.finalize,
    },
  }),
}))

vi.mock('@/components/auth/auth-errors', () => ({
  getAuthErrorMessage: () => 'Authentication failed.',
}))

import SignInForm from '@/components/auth/SignInForm'

beforeEach(() => {
  Object.values(signInMocks).forEach(mock => mock.mockReset())
})

describe('SignInForm', () => {
  it('starts Google OAuth sign-in', async () => {
    const user = userEvent.setup()

    signInMocks.authenticateWithRedirect.mockResolvedValueOnce(undefined)

    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(signInMocks.authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/',
    })
  })
})

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signUpMocks = vi.hoisted(() => ({
  create: vi.fn(),
  password: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
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
      signUp: {
        authenticateWithRedirect: signUpMocks.authenticateWithRedirect,
      },
    },
  }),
  useSignUp: () => ({
    signUp: {
      create: signUpMocks.create,
      password: signUpMocks.password,
      verifications: {
        sendEmailCode: signUpMocks.sendEmailCode,
        verifyEmailCode: signUpMocks.verifyEmailCode,
      },
      finalize: signUpMocks.finalize,
    },
  }),
}))

vi.mock('@/components/auth/auth-errors', () => ({
  getAuthErrorMessage: () => 'Authentication failed.',
  sendThemedAuthEmail: vi.fn(),
}))

import SignUpForm from '@/components/auth/SignUpForm'

beforeEach(() => {
  Object.values(signUpMocks).forEach(mock => mock.mockReset())
})

describe('SignUpForm', () => {
  it('renders the Clerk Smart CAPTCHA mount point for custom sign-up flows', () => {
    render(<SignUpForm />)

    expect(screen.getByTestId('clerk-captcha')).toHaveAttribute('id', 'clerk-captcha')
  })

  it('stores username as unsafe metadata instead of a Clerk username parameter', async () => {
    const user = userEvent.setup()

    signUpMocks.create.mockResolvedValueOnce({ error: null })
    signUpMocks.password.mockResolvedValueOnce({ error: null })
    signUpMocks.sendEmailCode.mockResolvedValueOnce({ error: null })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText('Email'), 'player@example.com')
    await user.type(screen.getByLabelText('Username'), 'playerone')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(signUpMocks.create).toHaveBeenCalledWith({
      emailAddress: 'player@example.com',
      unsafeMetadata: {
        username: 'playerone',
      },
    })
  })

  it('starts Google OAuth sign-up with optional username metadata', async () => {
    const user = userEvent.setup()

    signUpMocks.authenticateWithRedirect.mockResolvedValueOnce(undefined)

    render(<SignUpForm />)

    await user.type(screen.getByLabelText('Username'), 'playerone')
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(signUpMocks.authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/',
      unsafeMetadata: {
        username: 'playerone',
      },
    })
  })
})

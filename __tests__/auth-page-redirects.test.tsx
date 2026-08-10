// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/components/auth/GuestOnlyAuth', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/auth/SignUpForm', () => ({
  default: () => <div>Sign up form</div>,
}))

vi.mock('@/components/auth/SignInForm', () => ({
  default: () => <div>Sign in form</div>,
}))

vi.mock('@/components/auth/ForgotPasswordForm', () => ({
  default: () => <div>Forgot password form</div>,
}))

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import SignInPage from '@/app/(auth)/sign-in/page'
import SignUpPage from '@/app/(auth)/sign-up/page'

const guestPages = [
  { name: 'sign up', page: SignUpPage, formText: 'Sign up form' },
  { name: 'sign in', page: SignInPage, formText: 'Sign in form' },
  { name: 'forgot password', page: ForgotPasswordPage, formText: 'Forgot password form' },
]

beforeEach(() => {
  authMock.mockReset()
  redirectMock.mockClear()
})

describe('guest-only auth pages', () => {
  it.each(guestPages)('redirects signed-in users away from $name', async ({ page }) => {
    authMock.mockResolvedValueOnce({ userId: 'user_123' })

    await expect(page()).rejects.toThrow('NEXT_REDIRECT:/')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it.each(guestPages)('renders $name for signed-out users', async ({ page, formText }) => {
    authMock.mockResolvedValueOnce({ userId: null })

    render(await page())

    expect(screen.getByText(formText)).toBeInTheDocument()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

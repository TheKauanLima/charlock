// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs', () => ({
  AuthenticateWithRedirectCallback: (props: Record<string, string>) => (
    <output data-testid="sso-callback" data-props={JSON.stringify(props)} />
  ),
}))

import SsoCallbackPage from '@/app/sso-callback/page'

describe('SsoCallbackPage', () => {
  it('keeps Google authentication completion inside the custom sign-in routes', () => {
    render(<SsoCallbackPage />)

    expect(JSON.parse(screen.getByTestId('sso-callback').dataset.props ?? '{}')).toEqual({
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      signInFallbackRedirectUrl: '/',
      signUpFallbackRedirectUrl: '/',
    })
  })
})

interface ClerkErrorShape {
  errors?: Array<{
    code?: string
    message?: string
    longMessage?: string
  }>
}

function isClerkErrorShape(error: unknown): error is ClerkErrorShape {
  return typeof error === 'object' && error !== null && 'errors' in error
}

export function getAuthErrorMessage(error: unknown) {
  if (isClerkErrorShape(error)) {
    const firstError = error.errors?.[0]
    const code = firstError?.code

    if (code === 'form_identifier_exists' || code === 'form_identifier_exists__username') {
      return 'That username or email is already taken.'
    }

    if (code === 'form_password_incorrect' || code === 'form_password_or_identifier_incorrect') {
      return 'The identifier or password is incorrect.'
    }

    if (code === 'form_identifier_not_found') {
      return 'No account was found for that identifier.'
    }

    if (code === 'verification_code_invalid') {
      return 'That verification code is incorrect.'
    }

    if (code === 'form_password_not_strong_enough') {
      return 'Choose a stronger password before continuing.'
    }

    return firstError?.longMessage ?? firstError?.message ?? 'Authentication failed.'
  }

  return error instanceof Error ? error.message : 'Authentication failed.'
}

export async function sendThemedAuthEmail(email: string, type: 'verify_email' | 'reset_password') {
  try {
    await fetch('/api/auth/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type }),
    })
  } catch {
    // Clerk still sends the actionable code. The themed Resend email is a best-effort companion.
  }
}

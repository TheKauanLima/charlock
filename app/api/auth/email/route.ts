import { NextResponse } from 'next/server'

import { sendAuthEmail, type AuthEmailType } from '@/lib/resend'

interface AuthEmailRequest {
  email?: unknown
  type?: unknown
}

function isAuthEmailType(value: unknown): value is AuthEmailType {
  return value === 'verify_email' || value === 'reset_password'
}

export async function POST(request: Request) {
  let body: AuthEmailRequest

  try {
    body = await request.json() as AuthEmailRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.email !== 'string' || !body.email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  if (!isAuthEmailType(body.type)) {
    return NextResponse.json({ error: 'Unsupported auth email type' }, { status: 400 })
  }

  try {
    await sendAuthEmail(body.email, body.type)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send auth email'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

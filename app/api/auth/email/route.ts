import { NextResponse } from 'next/server'

import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { authEmailRequestSchema } from '@/lib/custom-hero-schemas'
import { enforceIpRateLimit } from '@/lib/rate-limit'
import { sendAuthEmail, type AuthEmailType } from '@/lib/resend'

export async function POST(request: Request) {
  try {
    enforceJsonMutationRequest(request)
    enforceIpRateLimit(request, {
      namespace: 'auth-email',
      limit: 5,
      windowMs: 10 * 60 * 1000,
    })
    const body = authEmailRequestSchema.parse(await readJsonRequestBody(request))

    await sendAuthEmail(body.email, body.type as AuthEmailType)
    return NextResponse.json({ success: true })
  } catch (error) {
    return toApiErrorResponse(error, 'Failed to send auth email')
  }
}

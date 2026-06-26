import type { NextRequest } from 'next/server'

import { toApiErrorResponse } from '@/lib/api-errors'
import { listProfileLikes } from '@/lib/profile-ledger'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const limit = Math.min(80, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 40) || 40))
    const likes = await listProfileLikes(id, limit)

    return Response.json({ likes })
  } catch (error) {
    return toApiErrorResponse(error, 'Profile likes request failed')
  }
}

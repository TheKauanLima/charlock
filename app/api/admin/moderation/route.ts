import { toApiErrorResponse } from '@/lib/api-errors'
import { listModerationQueue } from '@/lib/moderation'

export async function GET() {
  try {
    const moderation = await listModerationQueue()

    return Response.json({ moderation })
  } catch (error) {
    return toApiErrorResponse(error, 'Moderation queue request failed')
  }
}

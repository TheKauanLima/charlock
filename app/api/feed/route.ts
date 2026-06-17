import { toApiErrorResponse } from '@/lib/api-errors'
import { getActivityFeed } from '@/lib/social-engagement'

export async function GET() {
  try {
    const items = await getActivityFeed()

    return Response.json({ items })
  } catch (error) {
    return toApiErrorResponse(error, 'Activity feed request failed')
  }
}

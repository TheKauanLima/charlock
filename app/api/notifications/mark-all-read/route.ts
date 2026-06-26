import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { markAllNotificationsRead } from '@/lib/notifications'

export async function POST(request: Request) {
  try {
    enforceJsonMutationRequest(request)
    const result = await markAllNotificationsRead()

    return Response.json({ notifications: result })
  } catch (error) {
    return toApiErrorResponse(error, 'Notification update failed')
  }
}

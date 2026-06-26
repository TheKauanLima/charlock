import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { markNotificationRead } from '@/lib/notifications'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { id } = await context.params
    const body = await readJsonRequestBody(request) as { read?: unknown }
    const notification = await markNotificationRead(id, body.read !== false)

    return Response.json({ notification })
  } catch (error) {
    return toApiErrorResponse(error, 'Notification update failed')
  }
}

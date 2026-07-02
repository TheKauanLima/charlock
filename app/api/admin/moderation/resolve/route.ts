import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { moderationResolveRequestSchema } from '@/lib/moderation-schemas'
import { resolveModerationItem } from '@/lib/moderation'

export async function POST(request: Request) {
  try {
    enforceJsonMutationRequest(request)
    const body = moderationResolveRequestSchema.parse(await readJsonRequestBody(request))
    const resolution = await resolveModerationItem(body)

    return Response.json({ resolution })
  } catch (error) {
    return toApiErrorResponse(error, 'Moderation resolution failed')
  }
}

import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { toggleFollow } from '@/lib/social-engagement'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { id } = await context.params
    const follow = await toggleFollow(id)

    return Response.json({ follow })
  } catch (error) {
    return toApiErrorResponse(error, 'Follow request failed')
  }
}

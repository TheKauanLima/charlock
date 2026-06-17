import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { likeCustomHero } from '@/lib/custom-heroes'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const hero = await likeCustomHero(slug)

    return Response.json({ hero })
  } catch (error) {
    return toApiErrorResponse(error, 'Hero like request failed')
  }
}

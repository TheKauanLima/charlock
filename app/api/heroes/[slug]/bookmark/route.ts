import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { toggleHeroBookmark } from '@/lib/social-engagement'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const bookmark = await toggleHeroBookmark(slug)

    return Response.json({ bookmark })
  } catch (error) {
    return toApiErrorResponse(error, 'Bookmark request failed')
  }
}

import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { deleteCustomHero } from '@/lib/custom-heroes'

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const result = await deleteCustomHero(slug)

    return Response.json(result)
  } catch (error) {
    return toApiErrorResponse(error, 'Hero deletion failed')
  }
}

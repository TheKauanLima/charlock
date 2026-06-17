import { enforceJsonMutationRequest } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { recordCustomHeroCopy } from '@/lib/custom-heroes'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params

    await recordCustomHeroCopy(slug)

    return Response.json({ ok: true })
  } catch (error) {
    return toApiErrorResponse(error, 'Hero copy request failed')
  }
}

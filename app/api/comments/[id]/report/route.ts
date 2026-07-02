import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { contentReportRequestSchema } from '@/lib/moderation-schemas'
import { reportComment } from '@/lib/moderation'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { id } = await context.params
    const body = contentReportRequestSchema.parse(await readJsonRequestBody(request))
    const report = await reportComment(id, body)

    return Response.json({ report }, { status: 201 })
  } catch (error) {
    return toApiErrorResponse(error, 'Comment report failed')
  }
}

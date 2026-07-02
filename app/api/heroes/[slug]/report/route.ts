import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { contentReportRequestSchema } from '@/lib/moderation-schemas'
import { reportHero } from '@/lib/moderation'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const body = contentReportRequestSchema.parse(await readJsonRequestBody(request))
    const report = await reportHero(slug, body)

    return Response.json({ report }, { status: 201 })
  } catch (error) {
    return toApiErrorResponse(error, 'Character report failed')
  }
}

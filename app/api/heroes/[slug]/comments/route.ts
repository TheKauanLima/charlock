import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { heroCommentRequestSchema } from '@/lib/custom-hero-schemas'
import { deleteHeroComment, listHeroComments, postHeroComment } from '@/lib/social-engagement'

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const comments = await listHeroComments(slug)

    return Response.json({ comments })
  } catch (error) {
    return toApiErrorResponse(error, 'Comments request failed')
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const body = heroCommentRequestSchema.parse(await readJsonRequestBody(request))
    const comment = await postHeroComment(slug, body.content)

    return Response.json({ comment }, { status: 201 })
  } catch (error) {
    return toApiErrorResponse(error, 'Comments request failed')
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    enforceJsonMutationRequest(request)
    const { slug } = await context.params
    const url = new URL(request.url)
    const commentId = url.searchParams.get('commentId') ?? ''
    const result = await deleteHeroComment(slug, commentId)

    return Response.json(result)
  } catch (error) {
    return toApiErrorResponse(error, 'Comments request failed')
  }
}

import { CustomHeroError } from '@/lib/custom-heroes'
import { deleteHeroComment, listHeroComments, postHeroComment } from '@/lib/social-engagement'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Comments request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const comments = await listHeroComments(slug)

    return Response.json({ comments })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const body = await request.json()
    const comment = await postHeroComment(slug, body?.content)

    return Response.json({ comment }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const url = new URL(request.url)
    const commentId = url.searchParams.get('commentId') ?? ''
    const result = await deleteHeroComment(slug, commentId)

    return Response.json(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}

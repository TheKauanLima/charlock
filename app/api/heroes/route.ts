import type { NextRequest } from 'next/server'

import { enforceJsonMutationRequest, readJsonRequestBody } from '@/lib/api-guards'
import { toApiErrorResponse } from '@/lib/api-errors'
import { getEditableCustomHero, listCustomHeroPage, saveCustomHero } from '@/lib/custom-heroes'
import type { CustomHeroSort, CustomHeroStatus } from '@/lib/custom-hero-types'

function getStatus(value: string | null): CustomHeroStatus {
  return value === 'private' ? 'private' : 'published'
}

function getSort(value: string | null): CustomHeroSort {
  if (value === 'liked' || value === 'trending') {
    return value
  }

  return 'new'
}

function getBoundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')

    if (id) {
      const hero = await getEditableCustomHero(id)

      return Response.json({ hero })
    }

    const result = await listCustomHeroPage({
      status: getStatus(request.nextUrl.searchParams.get('status')),
      sort: getSort(request.nextUrl.searchParams.get('sort')),
      search: request.nextUrl.searchParams.get('search') ?? '',
      limit: getBoundedInteger(request.nextUrl.searchParams.get('limit'), 24, 60),
      offset: getBoundedInteger(request.nextUrl.searchParams.get('offset'), 0, 10000),
    })

    return Response.json(result)
  } catch (error) {
    return toApiErrorResponse(error, 'Hero request failed')
  }
}

export async function POST(request: Request) {
  try {
    enforceJsonMutationRequest(request)
    const payload = await readJsonRequestBody(request)
    const hero = await saveCustomHero(payload)

    return Response.json({ hero }, { status: 201 })
  } catch (error) {
    return toApiErrorResponse(error, 'Hero request failed')
  }
}

export async function PUT(request: Request) {
  try {
    enforceJsonMutationRequest(request)
    const payload = await readJsonRequestBody(request)
    const hero = await saveCustomHero(payload)

    return Response.json({ hero })
  } catch (error) {
    return toApiErrorResponse(error, 'Hero request failed')
  }
}

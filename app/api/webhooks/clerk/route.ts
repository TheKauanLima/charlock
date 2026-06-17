import { clerkClient } from '@clerk/nextjs/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { toApiErrorResponse } from '@/lib/api-errors'
import dbConnect from '@/lib/dbConnect'
import User from '@/lib/models/User'

interface ClerkEmailAddress {
  email_address: string
  id?: string
  verification?: {
    status?: string | null
  } | null
}

interface ClerkUserPayload {
  id: string
  email_addresses?: ClerkEmailAddress[]
  primary_email_address_id?: string | null
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  unsafe_metadata?: Record<string, unknown> | null
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: ClerkUserPayload
}

function getPrimaryEmailAddress(payload: ClerkUserPayload) {
  const primaryEmailId = payload.primary_email_address_id

  if (primaryEmailId && payload.email_addresses?.length) {
    const primary = payload.email_addresses.find(email => email.id === primaryEmailId)

    if (primary) {
      return primary.email_address
    }
  }

  return payload.email_addresses?.[0]?.email_address ?? null
}

function getPrimaryEmail(payload: ClerkUserPayload) {
  const primaryEmailId = payload.primary_email_address_id

  if (primaryEmailId && payload.email_addresses?.length) {
    const primary = payload.email_addresses.find(email => email.id === primaryEmailId)

    if (primary) {
      return primary
    }
  }

  return payload.email_addresses?.[0] ?? null
}

function getPrimaryEmailVerified(payload: ClerkUserPayload) {
  const primaryEmail = getPrimaryEmail(payload)

  return primaryEmail?.verification?.status === 'verified'
}

function getUsername(payload: ClerkUserPayload) {
  if (payload.username) {
    return payload.username
  }

  const metadataUsername = payload.unsafe_metadata?.username

  return typeof metadataUsername === 'string' && metadataUsername.trim() ? metadataUsername.trim() : null
}

async function verifyWebhook(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('Please define the CLERK_WEBHOOK_SECRET environment variable')
  }

  const headerStore = await headers()
  const svixId = headerStore.get('svix-id')
  const svixTimestamp = headerStore.get('svix-timestamp')
  const svixSignature = headerStore.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix headers')
  }

  const payload = await request.text()
  const wh = new Webhook(webhookSecret)

  return wh.verify(payload, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as ClerkWebhookEvent
}

export async function POST(request: Request) {
  let evt: ClerkWebhookEvent

  try {
    evt = await verifyWebhook(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    await dbConnect()

    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const email = getPrimaryEmailAddress(evt.data)

      if (!email) {
        return NextResponse.json(
          { error: 'Clerk user payload is missing an email address' },
          { status: 400 },
        )
      }

      const userDoc = await User.findOneAndUpdate(
        { clerkId: evt.data.id },
        {
          clerkId: evt.data.id,
          email,
          username: getUsername(evt.data),
          emailVerified: getPrimaryEmailVerified(evt.data),
          firstName: evt.data.first_name ?? null,
          lastName: evt.data.last_name ?? null,
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )

      if (!userDoc) {
        throw new Error('Failed to upsert MongoDB user record')
      }

      const client = await clerkClient()

      await client.users.updateUser(evt.data.id, {
        publicMetadata: {
          mongo_user_id: userDoc._id.toString(),
        },
      })

      return NextResponse.json({ success: true })
    }

    if (evt.type === 'user.deleted') {
      await User.deleteOne({ clerkId: evt.data.id })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ ignored: true })
  } catch (error) {
    return toApiErrorResponse(error, 'Unknown webhook error')
  }
}

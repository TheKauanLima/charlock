import type { Types } from 'mongoose'

import User from '@/lib/models/User'

export interface ClerkUserRecordInput {
  clerkId: string
  email: string
  username?: string | null
  emailVerified: boolean
  firstName?: string | null
  lastName?: string | null
}

export interface SyncedUserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  preferredHero?: string | null
  profileBackground?: string | null
  isPublic?: boolean | null
  anonymousEdits?: boolean | null
  customBio?: string | null
  bookmarks?: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

interface IdentityRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeUsername(username: string | null | undefined) {
  const trimmedUsername = username?.trim()

  return trimmedUsername || null
}

function sameObjectId(left: Types.ObjectId, right: Types.ObjectId) {
  return left.toString() === right.toString()
}

async function resolveUniqueUsername(username: string | null, ownerId: Types.ObjectId | null) {
  if (!username) {
    return null
  }

  const existing = await User.findOne({ username }).select('_id').lean<Pick<IdentityRecord, '_id'> | null>()

  if (existing && (!ownerId || !sameObjectId(existing._id, ownerId))) {
    return null
  }

  return username
}

export async function syncUserRecordFromClerk(input: ClerkUserRecordInput) {
  const email = normalizeEmail(input.email)
  const username = normalizeUsername(input.username)
  const existingByClerk = await User.findOne({ clerkId: input.clerkId }).select('_id clerkId email').lean<IdentityRecord | null>()
  const existingByEmail = existingByClerk?.email === email
    ? existingByClerk
    : await User.findOne({ email }).select('_id clerkId email').lean<IdentityRecord | null>()
  const hasSplitIdentity = Boolean(existingByClerk && existingByEmail && !sameObjectId(existingByClerk._id, existingByEmail._id))
  const targetRecord = existingByClerk ?? existingByEmail
  const targetId = targetRecord?._id ?? null
  const safeUsername = await resolveUniqueUsername(username, targetId)
  const setFields: Partial<ClerkUserRecordInput> = {
    clerkId: input.clerkId,
    username: safeUsername,
    emailVerified: input.emailVerified,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
  }

  if (!hasSplitIdentity) {
    setFields.email = email
  }

  return User.findOneAndUpdate(
    targetId ? { _id: targetId } : { clerkId: input.clerkId },
    { $set: setFields },
    {
      upsert: !targetId,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean<SyncedUserRecord | null>()
}

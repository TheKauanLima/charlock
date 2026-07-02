import 'server-only'

import { Types } from 'mongoose'

import { ApiRequestError } from '@/lib/api-errors'
import User from '@/lib/models/User'

export async function assertUserNotSuspended(userId: string) {
  const objectIdQuery = Types.ObjectId.isValid(userId) ? [{ _id: new Types.ObjectId(userId) }] : []
  const user = await User.findOne({
    $or: [
      { clerkId: userId },
      ...objectIdQuery,
    ],
  }).select('suspendedAt').lean<{ suspendedAt?: Date | null } | null>()

  if (user?.suspendedAt) {
    throw new ApiRequestError('Your account is suspended from community contributions', 403)
  }
}

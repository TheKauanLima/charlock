'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Types } from 'mongoose'

import { HEROES } from '@/lib/hero-data'
import dbConnect from '@/lib/dbConnect'
import CustomHero from '@/lib/models/CustomHero'
import User from '@/lib/models/User'
import { getCurrentProfileUser, getProfilePathSegment } from '@/lib/profile'
import { getProfileUsernameError } from '@/lib/usernames'

function getStringField(formData: FormData, field: string) {
  const value = formData.get(field)

  return typeof value === 'string' ? value.trim() : ''
}

function getValidHeroSlug(value: string) {
  return HEROES.some(hero => hero.slug === value) ? value : 'abrams'
}

async function getValidProfileBackground(value: string, user: Awaited<ReturnType<typeof getRequiredProfileUser>>) {
  const [type, id] = value.split(':')

  if (type === 'official') {
    return `official:${getValidHeroSlug(id)}`
  }

  if (type === 'custom' && Types.ObjectId.isValid(id)) {
    const ownerIds = [user.clerkId, user._id.toString()]
    const customHero = await CustomHero.exists({
      _id: new Types.ObjectId(id),
      createdByUserId: { $in: ownerIds },
    })

    if (customHero) {
      return `custom:${id}`
    }
  }

  return `official:${getValidHeroSlug(user.preferredHero ?? 'abrams')}`
}

async function getRequiredProfileUser() {
  const user = await getCurrentProfileUser()

  if (!user) {
    redirect('/sign-in')
  }

  return user
}

export interface ProfileBackgroundActionSuccess {
  success: true
  backgroundId: string
}

export interface ProfileBackgroundActionError {
  error: string
}

export type ProfileBackgroundActionResult = ProfileBackgroundActionSuccess | ProfileBackgroundActionError

export async function updatePreferredHero(preferredHero: string) {
  const user = await getRequiredProfileUser()
  const nextHero = getValidHeroSlug(preferredHero)

  await dbConnect()
  await User.updateOne(
    { clerkId: user.clerkId },
    {
      $set: {
        preferredHero: nextHero,
      },
    },
  )

  revalidatePath(`/profile/${getProfilePathSegment(user)}`)
  revalidatePath('/profile/settings')
}

export async function updateProfileBackground(profileBackground: string): Promise<ProfileBackgroundActionResult> {
  const user = await getRequiredProfileUser()

  try {
    await dbConnect()

    const nextBackground = await getValidProfileBackground(profileBackground, user)

    await User.updateOne(
      { clerkId: user.clerkId },
      {
        $set: {
          profileBackground: nextBackground,
        },
      },
    )

    revalidatePath(`/profile/${getProfilePathSegment(user)}`)
    revalidatePath('/profile/settings')

    return { success: true, backgroundId: nextBackground }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to synchronize profile background.',
    }
  }
}

export async function updateProfileSettings(formData: FormData) {
  const user = await getRequiredProfileUser()
  const preferredHero = getValidHeroSlug(getStringField(formData, 'preferredHero'))
  const customBio = getStringField(formData, 'customBio')

  await dbConnect()
  await User.updateOne(
    { clerkId: user.clerkId },
    {
      $set: {
        preferredHero,
        isPublic: formData.get('isPublic') === 'on',
        anonymousEdits: formData.get('anonymousEdits') === 'on',
        customBio: customBio || null,
      },
    },
  )

  revalidatePath(`/profile/${getProfilePathSegment(user)}`)
  revalidatePath('/profile/settings')
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 11000
}

export async function updateUsername(formData: FormData) {
  const user = await getRequiredProfileUser()
  const username = getStringField(formData, 'username')

  if (getProfileUsernameError(username)) {
    redirect('/profile/settings?usernameError=invalid')
  }

  await dbConnect()

  const existingUser = await User.findOne({
    username: new RegExp(`^${username}$`, 'i'),
  }).select('clerkId').lean<{ clerkId: string } | null>()

  if (existingUser && existingUser.clerkId !== user.clerkId) {
    redirect('/profile/settings?usernameError=taken')
  }

  const previousProfilePath = `/profile/${getProfilePathSegment(user)}`

  try {
    await User.updateOne(
      { clerkId: user.clerkId },
      { $set: { username } },
      { runValidators: true },
    )
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      redirect('/profile/settings?usernameError=taken')
    }

    throw error
  }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(user.clerkId, {
      unsafeMetadata: { username },
    })
  } catch {
    // MongoDB is the profile source of truth; Clerk metadata is a compatibility copy.
  }

  revalidatePath(previousProfilePath)
  revalidatePath(`/profile/${encodeURIComponent(username)}`)
  revalidatePath('/profile/settings')
  redirect('/profile/settings?usernameStatus=updated')
}

export async function deleteAccount(formData: FormData) {
  const user = await getRequiredProfileUser()
  const confirmation = getStringField(formData, 'confirmation')
  const expected = user.username?.trim() || user.email.split('@')[0] || user.clerkId

  if (confirmation !== expected) {
    redirect('/profile/settings?error=delete-confirmation')
  }

  await dbConnect()
  await User.deleteOne({ clerkId: user.clerkId })

  const client = await clerkClient()
  await client.users.deleteUser(user.clerkId)

  redirect('/sign-up')
}

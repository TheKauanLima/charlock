'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { HEROES } from '@/lib/hero-data'
import dbConnect from '@/lib/dbConnect'
import User from '@/lib/models/User'
import { getCurrentProfileUser, getProfilePathSegment } from '@/lib/profile'

function getStringField(formData: FormData, field: string) {
  const value = formData.get(field)

  return typeof value === 'string' ? value.trim() : ''
}

function getValidHeroSlug(value: string) {
  return HEROES.some(hero => hero.slug === value) ? value : 'abrams'
}

async function getRequiredProfileUser() {
  const user = await getCurrentProfileUser()

  if (!user) {
    redirect('/sign-in')
  }

  return user
}

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

import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { ApiRequestError } from '@/lib/api-errors'

function getConfiguredValues(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
}

export async function isCurrentUserAdmin() {
  const { userId } = await auth()

  if (!userId) {
    return false
  }

  const adminIds = getConfiguredValues('ADMIN_USER_IDS')

  if (adminIds.includes(userId.toLowerCase())) {
    return true
  }

  const adminEmails = [
    ...getConfiguredValues('ADMIN_USER_EMAILS'),
    ...getConfiguredValues('ADMIN_EMAILS'),
  ]

  if (!adminEmails.length) {
    return false
  }

  const user = await currentUser()
  const emails = user?.emailAddresses.map(entry => entry.emailAddress.toLowerCase()) ?? []

  return emails.some(email => adminEmails.includes(email))
}

export async function requireAdmin() {
  if (!await isCurrentUserAdmin()) {
    throw new ApiRequestError('Administrator access required', 403)
  }
}

export async function checkAdmin() {
  if (!await isCurrentUserAdmin()) {
    redirect('/')
  }
}

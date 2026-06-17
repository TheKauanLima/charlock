import { auth, clerkClient, getAuth } from '@clerk/nextjs/server'

const MONGO_USER_ID_CLAIM = 'mongo_user_id'

export async function getClerkUserFromRequest(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req)
  if (!auth.userId) return null
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(auth.userId)
    return user
  } catch {
    return null
  }
}

export function getClerkUserIdFromRequest(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req)
  return auth.userId ?? null
}

export async function getMongoUserIdFromSessionClaims() {
  const session = await auth()
  const claim = session.sessionClaims?.[MONGO_USER_ID_CLAIM]

  return typeof claim === 'string' && claim.length > 0 ? claim : null
}

export function getMongoUserIdFromRequest(req: Parameters<typeof getAuth>[0]) {
  const session = getAuth(req)
  const claim = session.sessionClaims?.[MONGO_USER_ID_CLAIM]

  return typeof claim === 'string' && claim.length > 0 ? claim : null
}

export default clerkClient

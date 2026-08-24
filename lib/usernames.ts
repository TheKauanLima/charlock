export const PROFILE_USERNAME_MIN_LENGTH = 3
export const PROFILE_USERNAME_MAX_LENGTH = 32

const PROFILE_USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
const RESERVED_PROFILE_USERNAMES = new Set(['settings'])

interface GeneratedUsernameInput {
  clerkId: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

function normalizeGeneratedPart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function stableUsernameSuffix(value: string) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36).padStart(6, '0').slice(-6)
}

export function generateProfileUsername({ clerkId, email, firstName, lastName }: GeneratedUsernameInput) {
  const fullName = [firstName, lastName].filter(Boolean).join('_')
  const emailName = email.split('@')[0] ?? ''
  const base = normalizeGeneratedPart(fullName) || normalizeGeneratedPart(emailName) || 'player'
  const suffix = stableUsernameSuffix(clerkId)
  const availableBaseLength = PROFILE_USERNAME_MAX_LENGTH - suffix.length - 1
  const shortenedBase = base.slice(0, availableBaseLength).replace(/_+$/g, '') || 'player'

  return `${shortenedBase}_${suffix}`
}

export function appendUsernameCollisionSuffix(username: string, attempt: number) {
  const suffix = `_${attempt}`
  const base = username.slice(0, PROFILE_USERNAME_MAX_LENGTH - suffix.length).replace(/_+$/g, '')

  return `${base}${suffix}`
}

export function getProfileUsernameError(username: string) {
  if (username.length < PROFILE_USERNAME_MIN_LENGTH || username.length > PROFILE_USERNAME_MAX_LENGTH) {
    return `Username must be ${PROFILE_USERNAME_MIN_LENGTH}-${PROFILE_USERNAME_MAX_LENGTH} characters.`
  }

  if (!PROFILE_USERNAME_PATTERN.test(username)) {
    return 'Username can only contain letters, numbers, and underscores.'
  }

  if (RESERVED_PROFILE_USERNAMES.has(username.toLowerCase())) {
    return 'That username is reserved.'
  }

  return null
}

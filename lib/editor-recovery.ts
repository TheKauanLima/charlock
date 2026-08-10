import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { EditorRenderSelection } from '@/lib/editor-assets'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
import type { HeroInfoDefinition } from '@/lib/hero-data'
import type { HeroInteraction } from '@/lib/custom-hero-types'

export const EDITOR_RECOVERY_STORAGE_KEY = 'charlock_editor_recovery_v1'
export const EDITOR_RECOVERY_STORAGE_PREFIX = 'charlock_editor_recovery_v2'
export const ANONYMOUS_RECOVERY_OWNER_ID = 'anonymous'
const RECOVERY_VERSION = 2

export type EditorRecoveryReason = 'editing' | 'save-pending' | 'save-failed'

export interface EditorRecoverySnapshot {
  version: 2
  savedAt: string
  ownerId: string
  recoveryReason: EditorRecoveryReason
  failureMessage?: string
  heroSlug: string
  savedHeroId: string | null
  heroInfo: HeroInfoDefinition
  background: string
  renderSelection: EditorRenderSelection
  heroName: string
  portrait: string
  allowCopies: boolean
  stats: HeroStatsPayload
  abilityStats: AbilityStatsPayload
  interactions?: HeroInteraction[]
}

interface RecoveryInput extends Omit<EditorRecoverySnapshot, 'version' | 'savedAt' | 'ownerId' | 'recoveryReason'> {
  savedAt?: string
  ownerId?: string
  recoveryReason?: EditorRecoveryReason
}

interface LegacyEditorRecoverySnapshot extends Omit<EditorRecoverySnapshot, 'version' | 'ownerId' | 'recoveryReason' | 'failureMessage'> {
  version: 1
}

function normalizeOwnerId(ownerId: string) {
  return ownerId.trim() || ANONYMOUS_RECOVERY_OWNER_ID
}

export function getEditorRecoveryStorageKey(ownerId = ANONYMOUS_RECOVERY_OWNER_ID) {
  return `${EDITOR_RECOVERY_STORAGE_PREFIX}:${encodeURIComponent(normalizeOwnerId(ownerId))}`
}

function isRecoverySnapshot(value: unknown): value is EditorRecoverySnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<EditorRecoverySnapshot>

  return snapshot.version === RECOVERY_VERSION
    && typeof snapshot.savedAt === 'string'
    && typeof snapshot.ownerId === 'string'
    && ['editing', 'save-pending', 'save-failed'].includes(snapshot.recoveryReason ?? '')
    && typeof snapshot.heroSlug === 'string'
    && typeof snapshot.background === 'string'
    && typeof snapshot.heroInfo === 'object'
    && typeof snapshot.stats === 'object'
    && typeof snapshot.abilityStats === 'object'
}

export function buildEditorRecoverySnapshot(input: RecoveryInput): EditorRecoverySnapshot {
  return {
    ...input,
    version: RECOVERY_VERSION,
    savedAt: input.savedAt ?? new Date().toISOString(),
    ownerId: normalizeOwnerId(input.ownerId ?? ANONYMOUS_RECOVERY_OWNER_ID),
    recoveryReason: input.recoveryReason ?? 'editing',
  }
}

export function writeEditorRecovery(snapshot: EditorRecoverySnapshot, storage: Pick<Storage, 'setItem'> = window.localStorage) {
  storage.setItem(getEditorRecoveryStorageKey(snapshot.ownerId), JSON.stringify(snapshot))
}

function readLegacyAnonymousRecovery(storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>) {
  const rawValue = storage.getItem(EDITOR_RECOVERY_STORAGE_KEY)
  const legacySnapshot = rawValue ? JSON.parse(rawValue) as Partial<LegacyEditorRecoverySnapshot> : null

  if (!legacySnapshot || legacySnapshot.version !== 1 || typeof legacySnapshot.savedAt !== 'string') {
    storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
    return null
  }

  const migratedSnapshot = buildEditorRecoverySnapshot({
    ...legacySnapshot as LegacyEditorRecoverySnapshot,
    ownerId: ANONYMOUS_RECOVERY_OWNER_ID,
    recoveryReason: 'editing',
  })

  writeEditorRecovery(migratedSnapshot, storage)
  storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
  return migratedSnapshot
}

export function readEditorRecovery(
  ownerId = ANONYMOUS_RECOVERY_OWNER_ID,
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> = window.localStorage,
) {
  const normalizedOwnerId = normalizeOwnerId(ownerId)

  try {
    const storageKey = getEditorRecoveryStorageKey(normalizedOwnerId)
    const rawValue = storage.getItem(storageKey)
    const snapshot = rawValue ? JSON.parse(rawValue) as unknown : null

    if (!snapshot && normalizedOwnerId === ANONYMOUS_RECOVERY_OWNER_ID) {
      return readLegacyAnonymousRecovery(storage)
    }

    if (!isRecoverySnapshot(snapshot) || snapshot.ownerId !== normalizedOwnerId) {
      storage.removeItem(storageKey)
      return null
    }

    return snapshot
  } catch {
    storage.removeItem(getEditorRecoveryStorageKey(normalizedOwnerId))
    return null
  }
}

export function clearEditorRecovery(
  ownerId = ANONYMOUS_RECOVERY_OWNER_ID,
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
) {
  storage.removeItem(getEditorRecoveryStorageKey(ownerId))

  if (normalizeOwnerId(ownerId) === ANONYMOUS_RECOVERY_OWNER_ID) {
    storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
  }
}

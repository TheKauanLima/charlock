import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { EditorRenderSelection } from '@/lib/editor-assets'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
import type { HeroInfoDefinition } from '@/lib/hero-data'

export const EDITOR_RECOVERY_STORAGE_KEY = 'charlock_editor_recovery_v1'
const RECOVERY_VERSION = 1
const MAX_RECOVERY_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface EditorRecoverySnapshot {
  version: 1
  savedAt: string
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
}

interface RecoveryInput extends Omit<EditorRecoverySnapshot, 'version' | 'savedAt'> {
  savedAt?: string
}

function isRecoverySnapshot(value: unknown): value is EditorRecoverySnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<EditorRecoverySnapshot>

  return snapshot.version === RECOVERY_VERSION
    && typeof snapshot.savedAt === 'string'
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
  }
}

export function writeEditorRecovery(snapshot: EditorRecoverySnapshot, storage: Pick<Storage, 'setItem'> = window.localStorage) {
  storage.setItem(EDITOR_RECOVERY_STORAGE_KEY, JSON.stringify(snapshot))
}

export function readEditorRecovery(storage: Pick<Storage, 'getItem' | 'removeItem'> = window.localStorage, now = Date.now()) {
  try {
    const rawValue = storage.getItem(EDITOR_RECOVERY_STORAGE_KEY)
    const snapshot = rawValue ? JSON.parse(rawValue) as unknown : null

    if (!isRecoverySnapshot(snapshot) || now - new Date(snapshot.savedAt).getTime() > MAX_RECOVERY_AGE_MS) {
      storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
      return null
    }

    return snapshot
  } catch {
    storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
    return null
  }
}

export function clearEditorRecovery(storage: Pick<Storage, 'removeItem'> = window.localStorage) {
  storage.removeItem(EDITOR_RECOVERY_STORAGE_KEY)
}

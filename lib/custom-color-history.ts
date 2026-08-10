export const CUSTOM_COLOR_HISTORY_STORAGE_KEY = 'charlock_recent_custom_colors_v2'

const LEGACY_CUSTOM_COLOR_STORAGE_KEYS = [
  'charlock_recent_custom_colors',
  'charlock_recent_rich_text_colors',
]
const MAX_RECENT_CUSTOM_COLORS = 8

export function normalizeCustomHexColor(value: string) {
  const trimmed = value.trim()

  return /^#[\da-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null
}

function readColorList(storageKey: string) {
  try {
    const parsedValue: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .map(value => typeof value === 'string' ? normalizeCustomHexColor(value) : null)
      .filter((value): value is string => Boolean(value))
  } catch {
    return []
  }
}

export function getRecentCustomColors() {
  if (typeof window === 'undefined') {
    return []
  }

  return Array.from(new Set([
    ...readColorList(CUSTOM_COLOR_HISTORY_STORAGE_KEY),
    ...LEGACY_CUSTOM_COLOR_STORAGE_KEYS.map(storageKey => readColorList(storageKey)[0]).filter((color): color is string => Boolean(color)),
  ])).slice(0, MAX_RECENT_CUSTOM_COLORS)
}

export function saveRecentCustomColor(color: string) {
  const normalizedColor = normalizeCustomHexColor(color)

  if (!normalizedColor || typeof window === 'undefined') {
    return getRecentCustomColors()
  }

  const recentColors = [
    normalizedColor,
    ...getRecentCustomColors().filter(recentColor => recentColor !== normalizedColor),
  ].slice(0, MAX_RECENT_CUSTOM_COLORS)

  window.localStorage.setItem(CUSTOM_COLOR_HISTORY_STORAGE_KEY, JSON.stringify(recentColors))
  LEGACY_CUSTOM_COLOR_STORAGE_KEYS.forEach(storageKey => window.localStorage.removeItem(storageKey))

  return recentColors
}

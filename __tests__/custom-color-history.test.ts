// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  CUSTOM_COLOR_HISTORY_STORAGE_KEY,
  getRecentCustomColors,
  saveRecentCustomColor,
} from '@/lib/custom-color-history'

describe('custom color history', () => {
  beforeEach(() => {
    window.localStorage.removeItem(CUSTOM_COLOR_HISTORY_STORAGE_KEY)
    window.localStorage.removeItem('charlock_recent_custom_colors')
    window.localStorage.removeItem('charlock_recent_rich_text_colors')
  })

  it('collapses continuously recorded legacy colors to the final recent choice during migration', () => {
    window.localStorage.setItem('charlock_recent_custom_colors', JSON.stringify([
      '#6366f1',
      '#6265f0',
      '#6164ef',
      '#6063ee',
    ]))
    window.localStorage.setItem('charlock_recent_rich_text_colors', JSON.stringify([
      '#123456',
      '#123455',
    ]))

    expect(getRecentCustomColors()).toEqual(['#6366f1', '#123456'])

    expect(saveRecentCustomColor('#abcdef')).toEqual(['#abcdef', '#6366f1', '#123456'])
    expect(JSON.parse(window.localStorage.getItem(CUSTOM_COLOR_HISTORY_STORAGE_KEY) ?? '[]')).toEqual([
      '#abcdef',
      '#6366f1',
      '#123456',
    ])
    expect(window.localStorage.getItem('charlock_recent_custom_colors')).toBeNull()
    expect(window.localStorage.getItem('charlock_recent_rich_text_colors')).toBeNull()
  })
})

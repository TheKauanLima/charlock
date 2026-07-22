import type { ClipboardEvent, KeyboardEvent } from 'react'

type LimitedTextElement = HTMLInputElement | HTMLTextAreaElement

const EDITING_SHORTCUT_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
  'Enter',
  'Escape',
])

export function getCharacterLimitMessage(label: string, maxLength: number) {
  return `${label} can be at most ${maxLength} characters.`
}

export function getItemLimitMessage(label: string, maxCount: number) {
  return `${label} can include at most ${maxCount} items.`
}

function getSelectionLength(element: LimitedTextElement) {
  const start = element.selectionStart ?? element.value.length
  const end = element.selectionEnd ?? element.value.length

  return Math.max(0, end - start)
}

export function notifyIfLimitedTextKeyDown(
  event: KeyboardEvent<LimitedTextElement>,
  value: string,
  maxLength: number,
  label: string,
  onBlockedAction?: (message: string) => void,
) {
  if (!onBlockedAction || event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey || EDITING_SHORTCUT_KEYS.has(event.key)) {
    return
  }

  if (value.length - getSelectionLength(event.currentTarget) >= maxLength) {
    onBlockedAction(getCharacterLimitMessage(label, maxLength))
  }
}

export function notifyIfLimitedTextPaste(
  event: ClipboardEvent<LimitedTextElement>,
  value: string,
  maxLength: number,
  label: string,
  onBlockedAction?: (message: string) => void,
) {
  if (!onBlockedAction) {
    return
  }

  const pastedText = event.clipboardData.getData('text')

  if (value.length - getSelectionLength(event.currentTarget) + pastedText.length > maxLength) {
    onBlockedAction(getCharacterLimitMessage(label, maxLength))
  }
}

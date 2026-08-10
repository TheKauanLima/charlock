import { useEffect, useRef } from 'react'
import type { MouseEventHandler } from 'react'

interface CommittedColorInputProps {
  value: string
  ariaLabel: string
  onCommit: (color: string) => void
  onMouseDown?: MouseEventHandler<HTMLInputElement>
}

export default function CommittedColorInput({ value, ariaLabel, onCommit, onMouseDown }: CommittedColorInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  useEffect(() => {
    const input = inputRef.current

    if (!input) {
      return undefined
    }

    const colorInput = input

    function handleCommittedColor() {
      onCommitRef.current(colorInput.value)
    }

    colorInput.addEventListener('change', handleCommittedColor)

    return () => colorInput.removeEventListener('change', handleCommittedColor)
  }, [])

  return (
    <input
      ref={inputRef}
      type="color"
      defaultValue={value}
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
    />
  )
}

'use client'

import { ArrowDown, ArrowUp, RotateCcw, RotateCw } from 'lucide-react'

import styles from './TagTransformControls.module.css'

export const TAG_TILT_BUTTON_STEP = 2
export const TAG_OFFSET_BUTTON_STEP = 2

interface TagTransformItem {
  label: string
  tilt: number
  offsetY: number
}

interface TagTransformControlsProps<T extends TagTransformItem> {
  tags: T[]
  onTiltChange: (tag: T, tilt: number) => void
  onOffsetChange: (tag: T, offsetY: number) => void
  onReset: (tag: T) => void
}

function formatTilt(tilt: number) {
  return `${Number(tilt.toFixed(1))}°`
}

// Non-drag alternative to the tag corner/edge handles (spec 23, D10). The parent clamps the values.
export default function TagTransformControls<T extends TagTransformItem>({ tags, onTiltChange, onOffsetChange, onReset }: TagTransformControlsProps<T>) {
  return (
    <div className={styles.root} data-testid="tag-transform-controls">
      <span className={styles.title}>Tag Tilt and Offset</span>
      {tags.map(tag => (
        <div key={tag.label} className={styles.row} role="group" aria-label={`${tag.label} adjustments`}>
          <span className={styles.label}>{tag.label}</span>
          <div className={styles.controls}>
            <button type="button" className={styles.stepButton} aria-label={`Rotate ${tag.label} counterclockwise`} onClick={() => onTiltChange(tag, tag.tilt - TAG_TILT_BUTTON_STEP)}>
              <RotateCcw aria-hidden="true" />
            </button>
            <span className={styles.value} data-testid={`${tag.label.toLowerCase().replace(/\s+/g, '-')}-tilt-value`}>{formatTilt(tag.tilt)}</span>
            <button type="button" className={styles.stepButton} aria-label={`Rotate ${tag.label} clockwise`} onClick={() => onTiltChange(tag, tag.tilt + TAG_TILT_BUTTON_STEP)}>
              <RotateCw aria-hidden="true" />
            </button>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.stepButton} aria-label={`Move ${tag.label} up`} onClick={() => onOffsetChange(tag, tag.offsetY - TAG_OFFSET_BUTTON_STEP)}>
              <ArrowUp aria-hidden="true" />
            </button>
            <span className={styles.value} data-testid={`${tag.label.toLowerCase().replace(/\s+/g, '-')}-offset-value`}>{`${tag.offsetY}px`}</span>
            <button type="button" className={styles.stepButton} aria-label={`Move ${tag.label} down`} onClick={() => onOffsetChange(tag, tag.offsetY + TAG_OFFSET_BUTTON_STEP)}>
              <ArrowDown aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className={styles.resetButton}
            aria-label={`Reset ${tag.label} tilt and offset`}
            disabled={tag.tilt === 0 && tag.offsetY === 0}
            onClick={() => onReset(tag)}
          >
            Reset
          </button>
        </div>
      ))}
    </div>
  )
}

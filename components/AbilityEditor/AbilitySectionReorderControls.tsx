import { ChevronDown, ChevronUp } from 'lucide-react'

import cn from '@/lib/utilsd'

import styles from './AbilityEditor.module.css'

interface AbilitySectionReorderControlsProps {
  sectionId: string
  sectionLabel: string
  previousSectionId: string | null
  nextSectionId: string | null
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void
}

// Touch-friendly alternative to the HTML5 drag handle, which never fires on touch screens.
export default function AbilitySectionReorderControls({ sectionId, sectionLabel, previousSectionId, nextSectionId, onReorder }: AbilitySectionReorderControlsProps) {
  return (
    <>
      <button
        type="button"
        className={cn(styles.sectionMoveButton, styles.sectionMoveUp)}
        aria-label={`Move ${sectionLabel} section up`}
        title="Move section up"
        disabled={!previousSectionId}
        onClick={() => {
          if (previousSectionId) {
            onReorder(sectionId, previousSectionId, 'before')
          }
        }}
      >
        <ChevronUp aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cn(styles.sectionMoveButton, styles.sectionMoveDown)}
        aria-label={`Move ${sectionLabel} section down`}
        title="Move section down"
        disabled={!nextSectionId}
        onClick={() => {
          if (nextSectionId) {
            onReorder(sectionId, nextSectionId, 'after')
          }
        }}
      >
        <ChevronDown aria-hidden="true" />
      </button>
    </>
  )
}

'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// The editor root is a positioned, z-indexed section and the control rail uses backdrop-filter,
// so fixed modals rendered inside them are trapped below the GlobalNav and tab bar (spec 23, A1).
// Every editor modal mounts on document.body instead.
export default function EditorModalPortal({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body)
}

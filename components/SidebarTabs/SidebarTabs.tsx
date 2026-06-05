import { HeartPulse, Info, Sparkles, Swords } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import cn from '@/lib/utilsd'

import styles from './SidebarTabs.module.css'

export type SidebarTabId = 'overview' | 'weapon' | 'vitality' | 'spirit'

export interface SidebarTabItem {
  id: SidebarTabId
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

interface SidebarTabsProps {
  activeTabId: SidebarTabId
  onSelect: (tabId: SidebarTabId) => void
  overviewLabel?: string
}

export const SIDEBAR_TAB_ITEMS: SidebarTabItem[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'weapon', label: 'Weapon stats', icon: Swords },
  { id: 'vitality', label: 'Vitality stats', icon: HeartPulse },
  { id: 'spirit', label: 'Spirit stats', icon: Sparkles },
]

export default function SidebarTabs({ activeTabId, onSelect, overviewLabel = 'Overview' }: SidebarTabsProps) {
  return (
    <nav
      className={styles.tabs}
      role="tablist"
      aria-label="Hero detail panels"
      aria-orientation="vertical"
      data-testid="hero-sidebar-tabs"
    >
      {SIDEBAR_TAB_ITEMS.map(tab => {
        const Icon = tab.icon
        const label = tab.id === 'overview' ? overviewLabel : tab.label
        const isActive = activeTabId === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`hero-panel-${tab.id}`}
            title={label}
            className={cn(styles.tabButton, isActive ? styles.tabButtonActive : styles.tabButtonInactive)}
            onClick={() => onSelect(tab.id)}
          >
            <Icon className={cn(styles.icon, isActive ? styles.iconActive : styles.iconInactive)} aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

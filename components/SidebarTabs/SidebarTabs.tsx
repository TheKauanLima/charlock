import { Info } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import cn from '@/lib/utilsd'

import styles from './SidebarTabs.module.css'

export type SidebarTabId = 'overview' | 'weapon' | 'vitality' | 'spirit'

interface SidebarTabBaseItem {
  id: SidebarTabId
  label: string
}

interface SidebarTabComponentItem extends SidebarTabBaseItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconSrc?: never
}

interface SidebarTabImageItem extends SidebarTabBaseItem {
  icon?: never
  iconSrc: string
}

export type SidebarTabItem = SidebarTabComponentItem | SidebarTabImageItem

interface SidebarTabsProps {
  activeTabId: SidebarTabId | null
  onSelect: (tabId: SidebarTabId) => void
  overviewLabel?: string
}

const HUD_CORE_ICON_PATHS = {
  courage: '/panorama/images/hud/core/icon_courage.svg',
  fortitude: '/panorama/images/hud/core/icon_fortitude.svg',
  spirit: '/panorama/images/hud/core/icon_spirit.svg',
} as const

export const SIDEBAR_TAB_ITEMS: SidebarTabItem[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'weapon', label: 'Weapon stats', iconSrc: HUD_CORE_ICON_PATHS.courage },
  { id: 'vitality', label: 'Vitality stats', iconSrc: HUD_CORE_ICON_PATHS.fortitude },
  { id: 'spirit', label: 'Spirit stats', iconSrc: HUD_CORE_ICON_PATHS.spirit },
]

function SidebarTabIcon({ tab, className }: { tab: SidebarTabItem; className: string }) {
  if ('iconSrc' in tab) {
    return (
      <span
        className={cn(className, styles.iconImage)}
        style={{
          WebkitMaskImage: `url('${tab.iconSrc}')`,
          maskImage: `url('${tab.iconSrc}')`,
        }}
        aria-hidden="true"
      />
    )
  }

  const Icon = tab.icon

  return <Icon className={className} aria-hidden />
}

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
        const label = tab.id === 'overview' ? overviewLabel : tab.label
        const isActive = activeTabId === tab.id
        const iconClassName = cn(styles.icon, isActive ? styles.iconActive : styles.iconInactive)

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
            <SidebarTabIcon tab={tab} className={iconClassName} />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

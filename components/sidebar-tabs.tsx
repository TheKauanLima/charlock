import { HeartPulse, Info, Sparkles, Swords } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import cn from '@/lib/utilsd'

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
      className="pointer-events-auto fixed right-[-40px] top-[43%] z-50 flex -translate-y-1/2 flex-col gap-2.5"
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
            className={cn(
              'flex h-11 w-[90px] items-center rounded-l-full border-0 py-1.5 pl-4 pr-11 shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]',
              isActive ? 'translate-x-0 bg-[#ffefd6] text-[#061d27]' : 'bg-[#ffefd6]/40 text-[#061d27]/55 hover:-translate-x-1 hover:bg-[#ffefd6]/85 hover:text-[#061d27]',
            )}
            onClick={() => onSelect(tab.id)}
          >
            <Icon className={cn('size-[22px] shrink-0 transition-opacity', isActive ? 'opacity-100' : 'opacity-60')} aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

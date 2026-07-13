'use client'

import { ArrowLeftRight } from 'lucide-react'
import type { CSSProperties, MouseEventHandler } from 'react'

import { DEFAULT_SECONDARY_ABILITY_SLOTS, getSecondaryAbilityIndexForPrimary, getSecondaryAbilitySlots } from '@/lib/ability-editor-types'
import type { AbilityDefinition } from '@/lib/ability-editor-types'
import type { HeroInfoDefinition } from '@/lib/hero-data'
import { getSquareIconStyle, isSquareIcon } from '@/lib/square-icon'
import cn from '@/lib/utilsd'

import styles from './HeroAbilityIconRow.module.css'

export type AbilityIconTarget = {
  set: 'primary' | 'secondary'
  index: number
}

type AbilityIconKey = 'ability1Icon' | 'ability2Icon' | 'ability3Icon' | 'ability4Icon'

interface HeroAbilityIconRowProps {
  heroInfo: HeroInfoDefinition
  secondaryAbilities?: AbilityDefinition[]
  secondaryAbilitySlots?: number[]
  secondaryAbilityAnchorIndex?: number
  activeTarget?: AbilityIconTarget | null
  onAbilityClick?: (target: AbilityIconTarget) => void
  onAbilitySwap?: (primaryIndex: number) => void
  className?: string
  primaryTestIdPrefix?: string
  secondaryTestIdPrefix?: string
  primaryLabel?: (slot: number, isActive: boolean) => string
  secondaryLabel?: (slot: number, isActive: boolean) => string
  selectedPrimaryIndexes?: number[]
  editable?: boolean
}

const ABILITY_ICON_KEYS: AbilityIconKey[] = ['ability1Icon', 'ability2Icon', 'ability3Icon', 'ability4Icon']
const getSecondaryCutout = (fill: string) => `radial-gradient(circle at 80% 80%, transparent 0 32%, ${fill} 33%)`

function getAbilityIconStyle(icon: string, color: string): CSSProperties {
  if (isSquareIcon(icon)) {
    return getSquareIconStyle(icon, color)
  }

  return {
    backgroundColor: color,
    WebkitMaskImage: `url('${icon}')`,
    maskImage: `url('${icon}')`,
  }
}

export default function HeroAbilityIconRow({
  heroInfo,
  secondaryAbilities = [],
  secondaryAbilitySlots,
  secondaryAbilityAnchorIndex,
  activeTarget = null,
  onAbilityClick,
  onAbilitySwap,
  className,
  primaryTestIdPrefix = 'hero-info-ability',
  secondaryTestIdPrefix = 'hero-info-secondary-ability',
  primaryLabel = slot => `Ability ${slot}`,
  secondaryLabel = slot => `Secondary Ability ${slot}`,
  selectedPrimaryIndexes = [],
  editable = false,
}: HeroAbilityIconRowProps) {
  const visibleSecondaryAbilitySlots = secondaryAbilities.length
    ? getSecondaryAbilitySlots(secondaryAbilitySlots, secondaryAbilityAnchorIndex, DEFAULT_SECONDARY_ABILITY_SLOTS)
    : []

  return (
    <div className={cn(styles.row, className)} aria-label={editable ? 'Editable hero ability icons' : 'Hero abilities'}>
      {ABILITY_ICON_KEYS.map((iconKey, index) => {
        const slot = index + 1
        const primaryTarget: AbilityIconTarget = { set: 'primary', index }
        const isPrimaryActive = activeTarget?.set === 'primary' && activeTarget.index === index
        const isPrimarySelected = selectedPrimaryIndexes.includes(index)
        const secondaryIndex = secondaryAbilities.length
          ? getSecondaryAbilityIndexForPrimary(index, visibleSecondaryAbilitySlots)
          : null
        const secondaryAbility = secondaryIndex !== null ? secondaryAbilities[secondaryIndex] : undefined
        const isSecondaryActive = secondaryIndex !== null && activeTarget?.set === 'secondary' && activeTarget.index === secondaryIndex
        const hasSecondary = Boolean(secondaryAbility)
        const primaryStyle = {
          background: hasSecondary
            ? getSecondaryCutout(heroInfo.abilityCircleColor)
            : heroInfo.abilityCircleColor,
          color: heroInfo.abilityCircleColor,
        } as CSSProperties
        const primaryIconStyle = getAbilityIconStyle(heroInfo[iconKey], heroInfo.abilityIconColor)
        const primaryIcon = (
          <span
            className={cn(styles.abilityIconClip, hasSecondary && styles.abilityIconClipWithSecondary)}
            style={hasSecondary ? {
              WebkitMaskImage: getSecondaryCutout('#000'),
              maskImage: getSecondaryCutout('#000'),
            } : undefined}
          >
            <span className={cn(styles.abilityIcon, hasSecondary && styles.abilityIconWithSecondary)} aria-hidden="true" style={primaryIconStyle} />
          </span>
        )
        const primaryClick: MouseEventHandler<HTMLButtonElement> | undefined = onAbilityClick
          ? () => onAbilityClick(primaryTarget)
          : undefined

        return (
          <span key={iconKey} className={cn(styles.wrap, hasSecondary && styles.wrapWithSecondary)}>
            {onAbilityClick ? (
              <button
                type="button"
                className={cn(styles.ability, hasSecondary && styles.abilityWithSecondary, (isPrimaryActive || isPrimarySelected) && styles.abilityActive)}
                data-testid={`${primaryTestIdPrefix}-${slot}`}
                aria-label={primaryLabel(slot, isPrimaryActive)}
                aria-pressed={isPrimaryActive || isPrimarySelected}
                style={primaryStyle}
                onClick={primaryClick}
              >
                {primaryIcon}
              </button>
            ) : (
              <span
                className={cn(styles.ability, hasSecondary && styles.abilityWithSecondary)}
                data-testid={`${primaryTestIdPrefix}-${slot}`}
                style={primaryStyle}
              >
                {primaryIcon}
              </span>
            )}

            {hasSecondary && secondaryAbility && secondaryIndex !== null ? (
              onAbilityClick ? (
                <button
                  type="button"
                  className={cn(styles.secondaryAbility, isSecondaryActive && styles.secondaryAbilityActive)}
                  data-testid={`${secondaryTestIdPrefix}-${secondaryIndex + 1}`}
                  aria-label={secondaryLabel(secondaryIndex + 1, isSecondaryActive)}
                  aria-pressed={isSecondaryActive}
                  style={{ backgroundColor: heroInfo.abilityCircleColor }}
                  onClick={() => onAbilityClick({ set: 'secondary', index: secondaryIndex })}
                >
                  <span
                    className={styles.secondaryAbilityIcon}
                    aria-hidden="true"
                    style={getAbilityIconStyle(secondaryAbility.icon, heroInfo.abilityIconColor)}
                  />
                </button>
              ) : (
                <span
                  className={styles.secondaryAbility}
                  data-testid={`${secondaryTestIdPrefix}-${secondaryIndex + 1}`}
                  style={{ backgroundColor: heroInfo.abilityCircleColor }}
                >
                  <span
                    className={styles.secondaryAbilityIcon}
                    aria-hidden="true"
                    style={getAbilityIconStyle(secondaryAbility.icon, heroInfo.abilityIconColor)}
                  />
                </span>
              )
            ) : null}

            {hasSecondary && onAbilitySwap ? (
              <button
                type="button"
                className={styles.swapAbility}
                aria-label={`Swap primary and secondary Ability ${slot}`}
                title={`Swap primary and secondary Ability ${slot}`}
                onClick={() => onAbilitySwap(index)}
              >
                <ArrowLeftRight aria-hidden="true" />
              </button>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

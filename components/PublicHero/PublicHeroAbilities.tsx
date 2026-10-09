import HeroAbilityIconRow from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import { getSecondaryAbilitySlots, type AbilityDefinition, type AbilitySection } from '@/lib/ability-editor-types'
import type { PublicHeroDetail } from '@/lib/public-page-types'

import { toPlainAbilityText } from './public-hero-utils'
import styles from './PublicHero.module.css'

function formatCell(cell: { label: string; value: string | number; unit?: string }) {
  const value = `${cell.value}${cell.unit ?? ''}`.trim()

  return cell.label ? `${toPlainAbilityText(cell.label)}: ${value}` : value
}

function AbilitySectionText({ section }: { section: AbilitySection }) {
  if (section.type === 'richText') {
    const text = toPlainAbilityText(section.text)

    if (!section.title && !text) return null

    return (
      <div className={styles.abilitySection}>
        {section.title ? <h4>{toPlainAbilityText(section.title)}</h4> : null}
        {text ? <p>{text}</p> : null}
      </div>
    )
  }

  const cells = [...section.mainCells, ...section.lowerCells]

  if (!section.title && !cells.length) return null

  return (
    <div className={styles.abilitySection}>
      {section.title ? <h4>{toPlainAbilityText(section.title)}</h4> : null}
      {cells.length ? (
        <ul>
          {cells.map(cell => <li key={cell.id}>{formatCell(cell)}</li>)}
        </ul>
      ) : null}
    </div>
  )
}

function AbilityEntry({ ability, label }: { ability: AbilityDefinition; label: string }) {
  const tiers = ability.tiers.filter(tier => toPlainAbilityText(tier.upgradeText))

  return (
    <li className={styles.abilityEntry}>
      <p className={styles.abilitySlot}>{label}</p>
      <h3>{toPlainAbilityText(ability.name) || label}</h3>
      {ability.sections.map(section => <AbilitySectionText key={section.id} section={section} />)}
      {tiers.length ? (
        <ol className={styles.abilityTiers} aria-label={`${toPlainAbilityText(ability.name) || label} upgrades`}>
          {tiers.map(tier => (
            <li key={tier.tier}>
              <span>Tier {tier.tier}</span> {toPlainAbilityText(tier.upgradeText)}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  )
}

export default function PublicHeroAbilities({ hero }: { hero: PublicHeroDetail }) {
  const abilityStats = hero.abilityStats
  const abilities = abilityStats?.abilities ?? []
  const secondaryAbilities = abilityStats?.secondaryAbilities ?? []
  const secondaryAbilitySlots = secondaryAbilities.length
    ? getSecondaryAbilitySlots(abilityStats?.secondaryAbilitySlots, abilityStats?.secondaryAbilityAnchorIndex, [])
    : []

  return (
    <section className={styles.panel} aria-labelledby="public-hero-abilities-heading">
      <h2 id="public-hero-abilities-heading" className={styles.sectionHeading}>Abilities</h2>
      <HeroAbilityIconRow
        heroInfo={hero.heroInfo}
        secondaryAbilities={secondaryAbilities}
        secondaryAbilitySlots={secondaryAbilitySlots}
        secondaryAbilityAnchorIndex={abilityStats?.secondaryAbilityAnchorIndex}
        className={styles.abilityRow}
      />
      {abilities.length || secondaryAbilities.length ? (
        <ul className={styles.abilityList}>
          {abilities.map((ability, index) => (
            <AbilityEntry key={`primary-${ability.slot}-${index}`} ability={ability} label={`Ability ${index + 1}`} />
          ))}
          {secondaryAbilities.map((ability, index) => (
            <AbilityEntry key={`secondary-${ability.slot}-${index}`} ability={ability} label={`Secondary ability ${index + 1}`} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

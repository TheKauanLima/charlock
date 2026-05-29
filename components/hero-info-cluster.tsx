'use client'

import styles from '@/components/hero-info-cluster.module.css'
import type { HeroDefinition } from '@/lib/hero-data'

interface HeroInfoClusterProps {
  hero: HeroDefinition
}

const ABILITY_SLOTS = [1, 2, 3, 4] as const

export default function HeroInfoCluster({ hero }: HeroInfoClusterProps) {
  const { heroInfo } = hero

  const tags = [
    { text: heroInfo.tag1Text, tilt: heroInfo.tag1Tilt },
    { text: heroInfo.tag2Text, tilt: heroInfo.tag2Tilt },
    { text: heroInfo.tag3Text, tilt: heroInfo.tag3Tilt },
  ]

  const abilities = [heroInfo.ability1Icon, heroInfo.ability2Icon, heroInfo.ability3Icon, heroInfo.ability4Icon]

  return (
    <aside
      className={styles.cluster}
      data-hero-slug={hero.slug}
      data-testid="hero-info-cluster"
      aria-label={`${hero.displayName} information cluster`}
    >
      <div className={styles.nameSection}>
        {heroInfo.nameType === 'image' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className={styles.nameImage}
            data-testid="hero-info-name-image"
            src={heroInfo.nameValue}
            alt={hero.displayName}
            style={{ color: heroInfo.nameColor }}
          />
        ) : (
          <span className={styles.nameText} data-testid="hero-info-name-text" style={{ color: heroInfo.nameColor }}>
            {heroInfo.nameValue}
          </span>
        )}
      </div>

      <div className={styles.tagsSection} aria-label="Hero tags">
        {tags.map((tag, index) => (
          <span
            key={`${hero.slug}-tag-${index + 1}`}
            className={styles.tag}
            data-testid={`hero-info-tag-${index + 1}`}
            style={{ transform: `rotate(${tag.tilt}deg)`, backgroundColor: heroInfo.tagColor, color: heroInfo.tagTextColor }}
          >
            <span className={styles.tagText}>{tag.text}</span>
          </span>
        ))}
      </div>

      <div className={styles.abilitiesSection} aria-label="Hero abilities">
        {ABILITY_SLOTS.map((slot, index) => {
          const icon = abilities[index]

          return (
            <span
              key={`${hero.slug}-ability-${slot}`}
              className={styles.abilitySlot}
              data-testid={`hero-info-ability-${slot}`}
              style={{ backgroundColor: heroInfo.abilityCircleColor, color: heroInfo.abilityCircleColor }}
            >
              <span
                className={styles.abilityIcon}
                aria-hidden="true"
                style={{
                  backgroundColor: heroInfo.abilityIconColor,
                  WebkitMaskImage: `url('${icon}')`,
                  maskImage: `url('${icon}')`,
                }}
              />
            </span>
          )
        })}
      </div>
    </aside>
  )
}
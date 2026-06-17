import { HERO_INFO_OVERRIDES } from './hero-info-overrides'

export interface HeroInfoDefinition {
  nameType: 'image' | 'text'
  nameValue: string
  nameColor: string
  nameFontSize?: string
  nameFontFamily?: string
  nameFontWeight?: string
  tag1Text: string
  tag2Text: string
  tag3Text: string
  tagColor: string
  tagTextColor: string
  tag1Tilt: number
  tag2Tilt: number
  tag3Tilt: number
  tag1OffsetY: number
  tag2OffsetY: number
  tag3OffsetY: number
  ability1Icon: string
  ability2Icon: string
  ability3Icon: string
  ability4Icon: string
  abilityCircleColor: string
  abilityIconColor: string
  backstory?: string
}

export interface HeroDefinition {
  slug: string
  assetSlug: string
  displayName: string
  portrait: string
  render: string
  heroInfo: HeroInfoDefinition
}

interface HeroSeed {
  slug: string
  displayName: string
  portrait: string
  render: string
  assetSlug?: string
}

interface HeroInfoTheme {
  tagTexts: [string, string, string]
  nameColor: string
  tagColor: string
  tagTextColor: string
  abilityCircleColor: string
  abilityIconColor: string
}

const HERO_INFO_THEMES: HeroInfoTheme[] = [
  { tagTexts: ['Pressure', 'Frontline', 'Burst'], nameColor: '#ffefd6', tagColor: '#473424', tagTextColor: '#fff4df', abilityCircleColor: '#f0ad5f', abilityIconColor: '#ffe5b8' },
  { tagTexts: ['Dive', 'Chase', 'Momentum'], nameColor: '#ffefd6', tagColor: '#18364a', tagTextColor: '#dff7ff', abilityCircleColor: '#4cb3e7', abilityIconColor: '#d7f2ff' },
  { tagTexts: ['Trap', 'Control', 'Zone'], nameColor: '#ffefd6', tagColor: '#372158', tagTextColor: '#f2eaff', abilityCircleColor: '#a074ff', abilityIconColor: '#f0e5ff' },
  { tagTexts: ['Skirmish', 'Harass', 'Tempo'], nameColor: '#ffefd6', tagColor: '#144630', tagTextColor: '#e6fff4', abilityCircleColor: '#43db91', abilityIconColor: '#d7ffe9' },
  { tagTexts: ['Ambush', 'Burst', 'Execute'], nameColor: '#ffefd6', tagColor: '#4a1e2b', tagTextColor: '#ffe6e2', abilityCircleColor: '#ff6f87', abilityIconColor: '#ffd6de' },
  { tagTexts: ['Utility', 'Support', 'Reset'], nameColor: '#ffefd6', tagColor: '#13363d', tagTextColor: '#e4fbff', abilityCircleColor: '#5cd6e1', abilityIconColor: '#daf9ff' },
]

type AssetSlugMapping = string | { name?: string; abilities?: string }

export const DEFAULT_HERO_NAME_FONT_SIZE = 'clamp(1.5rem, 3vw, 3.3rem)'
export const DEFAULT_HERO_NAME_FONT_FAMILY = 'var(--block, VALVEPulp, "Noto Sans", sans-serif)'
export const DEFAULT_HERO_NAME_FONT_WEIGHT = '900'

const HERO_ASSET_SLUGS: Record<string, AssetSlugMapping> = {
  greytalon: 'grey_talon',
  ladygeist: { name: 'lady_geist', abilities: 'spectre' },
  moandkrill: 'mo_krill',
  apollo: 'fencer',
  celeste: 'unicorn',
  graves: 'necro',
  holliday: 'holliday',
  mina: { abilities: 'vampirebat' },
  paradox: { abilities: 'chrono' },
  pocket: { abilities: 'synth' },
  paige: { abilities: 'bookworm' },
  rem: 'familiar',
  victor: { abilities: 'frank' },
  venator: 'priest',
  sinclair: { abilities: 'magician' },
  silver: 'werewolf',
}

function hashString(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 1

  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0

    let value = Math.imul(state ^ (state >>> 15), 1 | state)

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function buildTilt(random: () => number) {
  const raw = random() * 14 - 7

  return Number(raw.toFixed(1))
}

function buildUniqueTilts(seed: string) {
  const random = createSeededRandom(`${seed}:tag-tilts`)
  const tilts: number[] = []

  while (tilts.length < 3) {
    const tilt = buildTilt(random)

    if (!tilts.includes(tilt)) {
      tilts.push(tilt)
    }
  }

  return tilts as [number, number, number]
}

function buildTagOffsets(seed: string) {
  const random = createSeededRandom(`${seed}:tag-offsets`)

  return [Math.round(random() * 12 - 6), Math.round(random() * 12 - 6), Math.round(random() * 12 - 6)] as [number, number, number]
}

function createHeroInfo(nameAssetSlug: string, abilityAssetSlug: string, heroIndex: number): HeroInfoDefinition {
  const seed = `${nameAssetSlug}:${abilityAssetSlug}`
  const theme = HERO_INFO_THEMES[heroIndex % HERO_INFO_THEMES.length]
  const [tag1Tilt, tag2Tilt, tag3Tilt] = buildUniqueTilts(seed)
  const [tag1OffsetY, tag2OffsetY, tag3OffsetY] = buildTagOffsets(seed)

  return {
    nameType: 'image',
    nameValue: `/panorama/images/heroes/hero_names/${nameAssetSlug}.svg`,
    nameColor: theme.nameColor,
    nameFontSize: DEFAULT_HERO_NAME_FONT_SIZE,
    nameFontFamily: DEFAULT_HERO_NAME_FONT_FAMILY,
    nameFontWeight: DEFAULT_HERO_NAME_FONT_WEIGHT,
    tag1Text: theme.tagTexts[0],
    tag2Text: theme.tagTexts[1],
    tag3Text: theme.tagTexts[2],
    tagColor: theme.tagColor,
    tagTextColor: theme.tagTextColor,
    tag1Tilt,
    tag2Tilt,
    tag3Tilt,
    tag1OffsetY,
    tag2OffsetY,
    tag3OffsetY,
    ability1Icon: `/panorama/images/hud/abilities/${abilityAssetSlug}/1.png`,
    ability2Icon: `/panorama/images/hud/abilities/${abilityAssetSlug}/2.png`,
    ability3Icon: `/panorama/images/hud/abilities/${abilityAssetSlug}/3.png`,
    ability4Icon: `/panorama/images/hud/abilities/${abilityAssetSlug}/4.png`,
    abilityCircleColor: theme.abilityCircleColor,
    abilityIconColor: theme.abilityIconColor,
  }
}

function createHeroDefinition(hero: HeroSeed, heroIndex: number): HeroDefinition {
  const mapping = (hero.assetSlug as AssetSlugMapping) ?? HERO_ASSET_SLUGS[hero.slug]

  let nameAssetSlug = hero.slug
  let abilityAssetSlug = hero.slug

  if (typeof mapping === 'string') {
    nameAssetSlug = mapping
    abilityAssetSlug = mapping
  } else if (mapping && typeof mapping === 'object') {
    nameAssetSlug = mapping.name ?? hero.slug
    abilityAssetSlug = mapping.abilities ?? hero.slug
  } else if (typeof hero.assetSlug === 'string') {
    nameAssetSlug = hero.assetSlug
    abilityAssetSlug = hero.assetSlug
  }

  return {
    ...hero,
    assetSlug: nameAssetSlug,
    heroInfo: ((): HeroInfoDefinition => {
      const base = createHeroInfo(nameAssetSlug, abilityAssetSlug, heroIndex)
      const overrides = HERO_INFO_OVERRIDES[hero.slug]
      if (!overrides) return base
      return {
        ...base,
        ...overrides,
      }
    })(),
  }
}

const HERO_SEEDS: HeroSeed[] = [
  { slug: 'abrams', displayName: 'Abrams', portrait: '/panorama/images/heroes/abrams.png', render: '/render/Abrams_Render.png' },
  { slug: 'apollo', displayName: 'Apollo', portrait: '/panorama/images/heroes/apollo.png', render: '/render/Apollo_Render.png' },
  { slug: 'bebop', displayName: 'Bebop', portrait: '/panorama/images/heroes/bebop.png', render: '/render/Bebop_Render.png' },
  { slug: 'billy', displayName: 'Billy', portrait: '/panorama/images/heroes/billy.png', render: '/render/Billy_Render.png' },
  { slug: 'calico', displayName: 'Calico', portrait: '/panorama/images/heroes/calico.png', render: '/render/Calico_Render.png' },
  { slug: 'celeste', displayName: 'Celeste', portrait: '/panorama/images/heroes/celeste.png', render: '/render/Celeste_Render.png' },
  { slug: 'doorman', displayName: 'The Doorman', portrait: '/panorama/images/heroes/doorman.png', render: '/render/The_Doorman_Render.png' },
  { slug: 'drifter', displayName: 'Drifter', portrait: '/panorama/images/heroes/drifter.png', render: '/render/Drifter_Render.png' },
  { slug: 'dynamo', displayName: 'Dynamo', portrait: '/panorama/images/heroes/dynamo.png', render: '/render/Dynamo_Render.png' },
  { slug: 'graves', displayName: 'Graves', portrait: '/panorama/images/heroes/graves.png', render: '/render/Graves_Render.png' },
  { slug: 'greytalon', displayName: 'Grey Talon', portrait: '/panorama/images/heroes/greytalon.png', render: '/render/Grey_Talon_Render.png' },
  { slug: 'haze', displayName: 'Haze', portrait: '/panorama/images/heroes/haze.png', render: '/render/Haze_Render.png' },
  { slug: 'holliday', displayName: 'Holliday', portrait: '/panorama/images/heroes/holliday.png', render: '/render/Holliday_Render.png' },
  { slug: 'infernus', displayName: 'Infernus', portrait: '/panorama/images/heroes/infernus.png', render: '/render/Infernus_Render.png' },
  { slug: 'ivy', displayName: 'Ivy', portrait: '/panorama/images/heroes/ivy.png', render: '/render/Ivy_Render.png' },
  { slug: 'kelvin', displayName: 'Kelvin', portrait: '/panorama/images/heroes/kelvin.png', render: '/render/Kelvin_Render.png' },
  { slug: 'ladygeist', displayName: 'Lady Geist', portrait: '/panorama/images/heroes/ladygeist.png', render: '/render/Lady_Geist_Render.png' },
  { slug: 'lash', displayName: 'Lash', portrait: '/panorama/images/heroes/lash.png', render: '/render/Lash_Render.png' },
  { slug: 'mcginnis', displayName: 'McGinnis', portrait: '/panorama/images/heroes/mcginnis.png', render: '/render/McGinnis_Render.png' },
  { slug: 'mina', displayName: 'Mina', portrait: '/panorama/images/heroes/mina.png', render: '/render/Mina_Render.png' },
  { slug: 'mirage', displayName: 'Mirage', portrait: '/panorama/images/heroes/mirage.png', render: '/render/Mirage_Render.png' },
  { slug: 'moandkrill', displayName: 'Mo & Krill', portrait: '/panorama/images/heroes/moandkrill.png', render: '/render/Mo_&_Krill_Render.png' },
  { slug: 'paige', displayName: 'Paige', portrait: '/panorama/images/heroes/paige.png', render: '/render/Paige_Render.png' },
  { slug: 'paradox', displayName: 'Paradox', portrait: '/panorama/images/heroes/paradox.png', render: '/render/Paradox_Render.png' },
  { slug: 'pocket', displayName: 'Pocket', portrait: '/panorama/images/heroes/pocket.png', render: '/render/Pocket_Render.png' },
  { slug: 'rem', displayName: 'Rem', portrait: '/panorama/images/heroes/rem.png', render: '/render/Rem_Render.png' },
  { slug: 'seven', displayName: 'Seven', portrait: '/panorama/images/heroes/seven.png', render: '/render/Seven_Render.png' },
  { slug: 'shiv', displayName: 'Shiv', portrait: '/panorama/images/heroes/shiv.png', render: '/render/Shiv_Render.png' },
  { slug: 'silver', displayName: 'Silver', portrait: '/panorama/images/heroes/silver.png', render: '/render/Silver_Render.png' },
  { slug: 'sinclair', displayName: 'Sinclair', portrait: '/panorama/images/heroes/sinclair.png', render: '/render/Sinclair_Render.png' },
  { slug: 'venator', displayName: 'Venator', portrait: '/panorama/images/heroes/venator.png', render: '/render/Venator_Render.png' },
  { slug: 'victor', displayName: 'Victor', portrait: '/panorama/images/heroes/victor.png', render: '/render/Victor_Render.png' },
  { slug: 'vindicta', displayName: 'Vindicta', portrait: '/panorama/images/heroes/vindicta.png', render: '/render/Vindicta_Render.png' },
  { slug: 'viscous', displayName: 'Viscous', portrait: '/panorama/images/heroes/viscous.png', render: '/render/Viscous_Render.png' },
  { slug: 'vyper', displayName: 'Vyper', portrait: '/panorama/images/heroes/vyper.png', render: '/render/Vyper_Render.png' },
  { slug: 'warden', displayName: 'Warden', portrait: '/panorama/images/heroes/warden.png', render: '/render/Warden_Render.png' },
  { slug: 'wraith', displayName: 'Wraith', portrait: '/panorama/images/heroes/wraith.png', render: '/render/Wraith_Render.png' },
  { slug: 'yamato', displayName: 'Yamato', portrait: '/panorama/images/heroes/yamato.png', render: '/render/Yamato_Render.png' },
]

// Populate HERO_INFO_OVERRIDES with a baseline entry for every hero so you can
// edit tag texts/colors and other `HeroInfoDefinition` fields in one place.
// Each entry here contains the full heroInfo object generated from the
// existing seeded rules — edit values in `HERO_INFO_OVERRIDES` below and
// re-run the seeder to persist changes.
for (let i = 0; i < HERO_SEEDS.length; i++) {
  const hero = HERO_SEEDS[i]
  const mapping = (hero.assetSlug as AssetSlugMapping) ?? HERO_ASSET_SLUGS[hero.slug]

  let nameAssetSlug = hero.slug
  let abilityAssetSlug = hero.slug

  if (typeof mapping === 'string') {
    nameAssetSlug = mapping
    abilityAssetSlug = mapping
  } else if (mapping && typeof mapping === 'object') {
    nameAssetSlug = mapping.name ?? hero.slug
    abilityAssetSlug = mapping.abilities ?? hero.slug
  } else if (typeof hero.assetSlug === 'string') {
    nameAssetSlug = hero.assetSlug
    abilityAssetSlug = hero.assetSlug
  }

  // generate the canonical heroInfo for the hero and store it as the
  // editable override baseline (you can change any of these values later)
  // We only set entries that don't already exist so manual edits aren't lost
  if (!HERO_INFO_OVERRIDES[hero.slug]) {
    HERO_INFO_OVERRIDES[hero.slug] = createHeroInfo(nameAssetSlug, abilityAssetSlug, i)
  }
}

export const HEROES: HeroDefinition[] = HERO_SEEDS.map((hero, index) => createHeroDefinition(hero, index))

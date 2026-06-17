const HERO_INFO_THEMES = [
  { tagTexts: ['Pressure', 'Frontline', 'Burst'], nameColor: '#f1e7d2', tagColor: '#473424', tagTextColor: '#fff4df', abilityCircleColor: '#f0ad5f', abilityIconColor: '#ffe5b8' },
  { tagTexts: ['Dive', 'Chase', 'Momentum'], nameColor: '#d7f6ff', tagColor: '#18364a', tagTextColor: '#dff7ff', abilityCircleColor: '#4cb3e7', abilityIconColor: '#d7f2ff' },
  { tagTexts: ['Trap', 'Control', 'Zone'], nameColor: '#ece5ff', tagColor: '#372158', tagTextColor: '#f2eaff', abilityCircleColor: '#a074ff', abilityIconColor: '#f0e5ff' },
  { tagTexts: ['Skirmish', 'Harass', 'Tempo'], nameColor: '#ebfff4', tagColor: '#144630', tagTextColor: '#e6fff4', abilityCircleColor: '#43db91', abilityIconColor: '#d7ffe9' },
  { tagTexts: ['Ambush', 'Burst', 'Execute'], nameColor: '#fff1ef', tagColor: '#4a1e2b', tagTextColor: '#ffe6e2', abilityCircleColor: '#ff6f87', abilityIconColor: '#ffd6de' },
  { tagTexts: ['Utility', 'Support', 'Reset'], nameColor: '#ecfbff', tagColor: '#13363d', tagTextColor: '#e4fbff', abilityCircleColor: '#5cd6e1', abilityIconColor: '#daf9ff' },
]

const HERO_ASSET_SLUGS = {
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

const HERO_SEEDS = [
  'abrams','apollo','bebop','billy','calico','celeste','doorman','drifter','dynamo','graves','greytalon','haze','holliday','infernus','ivy','kelvin','ladygeist','lash','mcginnis','mina','mirage','moandkrill','paige','paradox','pocket','rem','seven','shiv','silver','sinclair','venator','victor','vindicta','viscous','vyper','warden','wraith','yamato'
]

function hashString(seed) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}
function createSeededRandom(seed) {
  let state = hashString(seed) || 1
  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
function buildTilt(random) {
  const raw = random() * 14 - 7
  return Number(raw.toFixed(1))
}
function buildUniqueTilts(seed) {
  const random = createSeededRandom(`${seed}:tag-tilts`)
  const tilts = []
  while (tilts.length < 3) {
    const tilt = buildTilt(random)
    if (!tilts.includes(tilt)) tilts.push(tilt)
  }
  return tilts
}
function buildTagOffsets(seed) {
  const random = createSeededRandom(`${seed}:tag-offsets`)
  return [Math.round(random() * 12 - 6), Math.round(random() * 12 - 6), Math.round(random() * 12 - 6)]
}

function createHeroInfo(nameAssetSlug, abilityAssetSlug, heroIndex) {
  const seed = `${nameAssetSlug}:${abilityAssetSlug}`
  const theme = HERO_INFO_THEMES[heroIndex % HERO_INFO_THEMES.length]
  const [tag1Tilt, tag2Tilt, tag3Tilt] = buildUniqueTilts(seed)
  const [tag1OffsetY, tag2OffsetY, tag3OffsetY] = buildTagOffsets(seed)
  return {
    nameType: 'image',
    nameValue: `/panorama/images/heroes/hero_names/${nameAssetSlug}.svg`,
    nameColor: theme.nameColor,
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

function resolveMapping(slug) {
  const mapping = HERO_ASSET_SLUGS[slug]
  let nameAssetSlug = slug
  let abilityAssetSlug = slug
  if (typeof mapping === 'string') { nameAssetSlug = mapping; abilityAssetSlug = mapping }
  else if (mapping && typeof mapping === 'object') { nameAssetSlug = mapping.name ?? slug; abilityAssetSlug = mapping.abilities ?? slug }
  return { nameAssetSlug, abilityAssetSlug }
}

const overrides = {}
for (let i = 0; i < HERO_SEEDS.length; i++) {
  const slug = HERO_SEEDS[i]
  const { nameAssetSlug, abilityAssetSlug } = resolveMapping(slug)
  overrides[slug] = createHeroInfo(nameAssetSlug, abilityAssetSlug, i)
}

console.log(JSON.stringify(overrides, null, 2))

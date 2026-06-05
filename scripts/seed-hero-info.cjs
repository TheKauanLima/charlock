const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI
const REFERENCE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

if (!MONGODB_URI) {
  console.error('Please set MONGODB_URI environment variable')
  process.exit(1)
}

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
  holliday: 'astro',
  mina: { abilities: 'vampirebat' },
  paradox: { abilities: 'chrono' },
  pocket: { abilities: 'synth' },
  paige: { abilities: 'bookworm' },
  rem: { abilities: 'familiar' },
  victor: { abilities: 'frank' },
  venator: { abilities: 'priest' },
  sinclair: { abilities: 'magician' },
}

const HERO_SEEDS = [
  { slug: 'abrams', displayName: 'Abrams' },
  { slug: 'apollo', displayName: 'Apollo' },
  { slug: 'bebop', displayName: 'Bebop' },
  { slug: 'billy', displayName: 'Billy' },
  { slug: 'calico', displayName: 'Calico' },
  { slug: 'celeste', displayName: 'Celeste' },
  { slug: 'doorman', displayName: 'The Doorman' },
  { slug: 'drifter', displayName: 'Drifter' },
  { slug: 'dynamo', displayName: 'Dynamo' },
  { slug: 'graves', displayName: 'Graves' },
  { slug: 'greytalon', displayName: 'Grey Talon' },
  { slug: 'haze', displayName: 'Haze' },
  { slug: 'holliday', displayName: 'Holliday' },
  { slug: 'infernus', displayName: 'Infernus' },
  { slug: 'ivy', displayName: 'Ivy' },
  { slug: 'kelvin', displayName: 'Kelvin' },
  { slug: 'ladygeist', displayName: 'Lady Geist' },
  { slug: 'lash', displayName: 'Lash' },
  { slug: 'mcginnis', displayName: 'McGinnis' },
  { slug: 'mina', displayName: 'Mina' },
  { slug: 'mirage', displayName: 'Mirage' },
  { slug: 'moandkrill', displayName: 'Mo & Krill' },
  { slug: 'paige', displayName: 'Paige' },
  { slug: 'paradox', displayName: 'Paradox' },
  { slug: 'pocket', displayName: 'Pocket' },
  { slug: 'rem', displayName: 'Rem' },
  { slug: 'seven', displayName: 'Seven' },
  { slug: 'shiv', displayName: 'Shiv' },
  { slug: 'silver', displayName: 'Silver' },
  { slug: 'sinclair', displayName: 'Sinclair' },
  { slug: 'venator', displayName: 'Venator' },
  { slug: 'victor', displayName: 'Victor' },
  { slug: 'vindicta', displayName: 'Vindicta' },
  { slug: 'viscous', displayName: 'Viscous' },
  { slug: 'vyper', displayName: 'Vyper' },
  { slug: 'warden', displayName: 'Warden' },
  { slug: 'wraith', displayName: 'Wraith' },
  { slug: 'yamato', displayName: 'Yamato' },
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
    state = (state + 0x6d2b79f5) | 0

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

    if (!tilts.includes(tilt)) {
      tilts.push(tilt)
    }
  }

  return tilts
}

function buildTagOffsets(seed) {
  const random = createSeededRandom(`${seed}:tag-offsets`)

  return [Math.round(random() * 12 - 6), Math.round(random() * 12 - 6), Math.round(random() * 12 - 6)]
}

function loadHeroInfoOverrides() {
  const filePath = path.join(process.cwd(), 'lib', 'hero-info-overrides.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  const match = text.match(/export const HERO_INFO_OVERRIDES:[\s\S]*?=\s*({[\s\S]*})\s*$/)

  if (!match) {
    throw new Error('Could not parse lib/hero-info-overrides.ts')
  }

  return Function(`return (${match[1]})`)()
}

function readOptionalTextFile(directory, baseName) {
  const candidates = ['.txt', '.md'].map(extension => path.join(directory, `${baseName}${extension}`))
  const filePath = candidates.find(candidate => fs.existsSync(candidate))

  return filePath ? fs.readFileSync(filePath, 'utf8').trim() : ''
}

function loadReferenceData() {
  const referencesDir = path.join(process.cwd(), 'references')

  if (!fs.existsSync(referencesDir)) {
    return {}
  }

  return fs
    .readdirSync(referencesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('!'))
    .reduce((acc, entry) => {
      const directory = path.join(referencesDir, entry.name)
      const snapshotImages = fs
        .readdirSync(directory, { withFileTypes: true })
        .filter(file => file.isFile() && REFERENCE_IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
        .map(file => path.join('references', entry.name, file.name))

      acc[entry.name] = {
        snapshotImages,
        backstory: readOptionalTextFile(directory, 'backstory'),
        // OCR/manual extraction should populate this object from snapshotImages.
        extractedStats: {},
      }

      return acc
    }, {})
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

function resolveMapping(hero) {
  const mapping = HERO_ASSET_SLUGS[hero.slug]

  let nameAssetSlug = hero.slug
  let abilityAssetSlug = hero.slug

  if (typeof mapping === 'string') {
    nameAssetSlug = mapping
    abilityAssetSlug = mapping
  } else if (mapping && typeof mapping === 'object') {
    nameAssetSlug = mapping.name ?? hero.slug
    abilityAssetSlug = mapping.abilities ?? hero.slug
  }

  return { nameAssetSlug, abilityAssetSlug }
}

async function run() {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })

  const heroes = mongoose.connection.collection('heroes')
  const collection = mongoose.connection.collection('heroinfos')
  const overrides = loadHeroInfoOverrides()
  const referencesBySlug = loadReferenceData()

  const mapping = {}

  for (let i = 0; i < HERO_SEEDS.length; i++) {
    const hero = HERO_SEEDS[i]
    const heroInfo = overrides[hero.slug]

    if (!heroInfo) {
      console.warn(`No override found for ${hero.slug}; skipping`)
      continue
    }

    const now = new Date()
    const { nameAssetSlug } = resolveMapping(hero)

    await heroes.updateOne(
      { slug: hero.slug },
      {
        $set: {
          name: hero.displayName,
          slug: hero.slug,
          portrait: `/panorama/images/heroes/${nameAssetSlug}.png`,
          render: `/render/${hero.displayName.replaceAll(' ', '_').replaceAll('&', 'and')}_Render.png`,
          createdByUserId: process.env.HERO_SEED_CREATED_BY_USER_ID || 'system',
          status: 'published',
          publishedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )

    const persistedHero = await heroes.findOne({ slug: hero.slug }, { projection: { _id: 1 } })
    const referenceData = referencesBySlug[hero.slug]
    const doc = Object.assign(
      {
        heroId: persistedHero._id,
        tag1OffsetY: heroInfo.tag1OffsetY ?? 0,
        tag2OffsetY: heroInfo.tag2OffsetY ?? 0,
        tag3OffsetY: heroInfo.tag3OffsetY ?? 0,
        backstory: referenceData?.backstory || heroInfo.backstory || '',
        createdAt: now,
        updatedAt: now,
      },
      heroInfo,
    )

    await collection.updateOne({ heroId: persistedHero._id }, { $set: doc }, { upsert: true })

    mapping[hero.slug] = true
  }

  console.log('Seeded HeroInfo documents for', Object.keys(mapping).length, 'heroes')

  await mongoose.disconnect()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

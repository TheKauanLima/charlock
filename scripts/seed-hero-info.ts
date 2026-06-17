// @ts-nocheck

import fs from 'fs'
import path from 'path'

const dbConnect = require('../lib/dbConnect').default
const Hero = require('../lib/models/Hero').default
const HeroInfo = require('../lib/models/HeroInfo').default
const SpiritStats = require('../lib/models/SpiritStats').default
const VitalityStats = require('../lib/models/VitalityStats').default
const WeaponStats = require('../lib/models/WeaponStats').default
const { HEROES } = require('../lib/hero-data')
const { buildHeroStatsSeed } = require('../lib/hero-stats-shared')

const REFERENCE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function readOptionalTextFile(directory: string, baseName: string) {
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
        // Example shape: { bullet_damage: 13.5, heavy_melee_damage_weapon_scaling: 0.6 }
        extractedStats: {},
      }

      return acc
    }, {})
}

async function run() {
  const conn = await dbConnect()
  const referencesBySlug = loadReferenceData()

  try {
    console.log('Seeding HeroInfo documents...')

    const mapping: Record<string, string> = {}

    for (const hero of HEROES) {
      const now = new Date()
      const persistedHero = await Hero.findOneAndUpdate(
        { slug: hero.slug },
        {
          name: hero.displayName,
          slug: hero.slug,
          assetSlug: hero.assetSlug,
          portrait: hero.portrait,
          render: hero.render,
          createdByUserId: process.env.HERO_SEED_CREATED_BY_USER_ID || 'system',
          status: 'published',
          publishedAt: now,
          updatedAt: now,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      const referenceData = referencesBySlug[hero.slug]
      const doc = {
        heroId: persistedHero._id,
        nameType: hero.heroInfo.nameType,
        nameValue: hero.heroInfo.nameValue,
        nameColor: hero.heroInfo.nameColor,
        tag1Text: hero.heroInfo.tag1Text,
        tag2Text: hero.heroInfo.tag2Text,
        tag3Text: hero.heroInfo.tag3Text,
        tagColor: hero.heroInfo.tagColor,
        tagTextColor: hero.heroInfo.tagTextColor,
        tag1Tilt: hero.heroInfo.tag1Tilt,
        tag2Tilt: hero.heroInfo.tag2Tilt,
        tag3Tilt: hero.heroInfo.tag3Tilt,
        tag1OffsetY: hero.heroInfo.tag1OffsetY,
        tag2OffsetY: hero.heroInfo.tag2OffsetY,
        tag3OffsetY: hero.heroInfo.tag3OffsetY,
        ability1Icon: hero.heroInfo.ability1Icon,
        ability2Icon: hero.heroInfo.ability2Icon,
        ability3Icon: hero.heroInfo.ability3Icon,
        ability4Icon: hero.heroInfo.ability4Icon,
        abilityCircleColor: hero.heroInfo.abilityCircleColor,
        abilityIconColor: hero.heroInfo.abilityIconColor,
        backstory: referenceData?.backstory || hero.heroInfo.backstory || '',
      }
      const payload = buildHeroStatsSeed(hero)

      await HeroInfo.findOneAndUpdate({ heroId: persistedHero._id }, doc, { upsert: true, returnDocument: 'after' })
      await WeaponStats.findOneAndUpdate({ heroId: persistedHero._id }, { ...payload.weapon, heroId: persistedHero._id }, { upsert: true, returnDocument: 'after' })
      await VitalityStats.findOneAndUpdate({ heroId: persistedHero._id }, { ...payload.vitality, heroId: persistedHero._id }, { upsert: true, returnDocument: 'after' })
      await SpiritStats.findOneAndUpdate({ heroId: persistedHero._id }, { ...payload.spirit, heroId: persistedHero._id }, { upsert: true, returnDocument: 'after' })

      mapping[hero.slug] = persistedHero._id.toHexString()
    }

    console.log('Seeding complete. Hero slug -> heroId mapping:')
    console.log(JSON.stringify(mapping, null, 2))
  } catch (err) {
    console.error('Seeding failed:', err)
    process.exit(1)
  } finally {
    await conn.disconnect()
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

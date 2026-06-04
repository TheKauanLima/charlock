// @ts-nocheck

import { Types } from 'mongoose'

const dbConnect = require('../lib/dbConnect').default
const HeroInfo = require('../lib/models/HeroInfo').default
const { HEROES } = require('../lib/hero-data')

async function run() {
  const conn = await dbConnect()

  try {
    console.log('Seeding HeroInfo documents...')

    const mapping: Record<string, string> = {}

    for (const hero of HEROES) {
      const heroObjectId = new Types.ObjectId()

      const doc = {
        heroId: heroObjectId,
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
        ability1Icon: hero.heroInfo.ability1Icon,
        ability2Icon: hero.heroInfo.ability2Icon,
        ability3Icon: hero.heroInfo.ability3Icon,
        ability4Icon: hero.heroInfo.ability4Icon,
        abilityCircleColor: hero.heroInfo.abilityCircleColor,
        abilityIconColor: hero.heroInfo.abilityIconColor,
      }

      // Upsert by nameValue to avoid duplicates on re-run
      await HeroInfo.findOneAndUpdate({ nameValue: hero.heroInfo.nameValue }, doc, { upsert: true, new: true })

      mapping[hero.slug] = heroObjectId.toHexString()
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

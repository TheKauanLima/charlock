// @ts-nocheck
import { Types } from 'mongoose'
const dbConnect = require('../lib/dbConnect').default
const Hero = require('../lib/models/Hero').default
const HeroInfo = require('../lib/models/HeroInfo').default
const WeaponStats = require('../lib/models/WeaponStats').default
const VitalityStats = require('../lib/models/VitalityStats').default
const SpiritStats = require('../lib/models/SpiritStats').default

async function run() {
  const conn = await dbConnect()

  try {
    console.log('Seeding Abrams data...')

    // 1. Find or Create Abrams Hero
    let abrams = await Hero.findOne({ slug: 'abrams' })
    if (!abrams) {
      abrams = await Hero.create({
        name: 'Abrams',
        slug: 'abrams',
        portrait: '/panorama/images/heroes/abrams.png',
        render: '/render/Abrams_Render.png',
        assetSlug: 'abrams',
        createdByUserId: 'system',
        status: 'published'
      })
    }
    const heroId = abrams._id

    // 2. Seed HeroInfo
    const infoDoc = {
      heroId,
      nameType: 'image',
      nameValue: '/panorama/images/heroes/hero_names/abrams.svg',
      nameColor: '#ffefd6',
      tag1Text: 'TANK',
      tag2Text: 'BRAWLER',
      tag3Text: 'BULL-HEADED',
      tagColor: '#2292af',
      tagTextColor: '#fef2d8',
      tag1Tilt: 3.1,
      tag2Tilt: 6.8,
      tag3Tilt: 6.9,
      tag1OffsetY: 2,
      tag2OffsetY: -3,
      tag3OffsetY: -1,
      ability1Icon: '/panorama/images/hud/abilities/abrams/1.png',
      ability2Icon: '/panorama/images/hud/abilities/abrams/2.png',
      ability3Icon: '/panorama/images/hud/abilities/abrams/3.png',
      ability4Icon: '/panorama/images/hud/abilities/abrams/4.png',
      abilityCircleColor: '#2092ae',
      abilityIconColor: '#022021',
      backstory: "Abrams is a detective from the 13th precinct, but his cases often lead him into the world of the occult. He has seen things that would drive most men mad, but his faith in justice keeps him grounded. He fights with a holy shotgun and the strength of his own two fists."
    }
    await HeroInfo.findOneAndUpdate({ heroId }, infoDoc, { upsert: true })

    // 3. Seed WeaponStats
    const weaponDoc = {
      heroId,
      weaponName: 'Custom Shotgun',
      weaponDesc: 'A heavy-duty shotgun modified for close-quarters occult combat.',
      gunImageSrc: '/panorama/images/hud/abilities/abrams/weapon.png',
      weaponAttributes: ['Close Range', 'High Damage', 'Low Clip'],
      bulletDPS: 45,
      weaponMinRange: 8,
      weaponMaxRange: 30,
      stats: [
        { label: 'Bullet Damage', value: '30', unit: '', icon: 'damage', scaling: 'none', scalingValue: '0' },
        { label: 'Bullets per sec', value: '1.5', unit: '', icon: 'fire_rate', scaling: 'none', scalingValue: '0' },
        { label: 'Ammo', value: '6', unit: '', icon: 'ammo', scaling: 'none', scalingValue: '0' },
        { label: 'Reload Time', value: '2.1', unit: 's', icon: 'reload', scaling: 'none', scalingValue: '0' },
        { label: 'Bullet Velocity', value: '250', unit: 'm/s', icon: 'velocity', scaling: 'none', scalingValue: '0' }
      ]
    }
    await WeaponStats.findOneAndUpdate({ heroId }, weaponDoc, { upsert: true })

    // 4. Seed VitalityStats
    const vitalityDoc = {
      heroId,
      stats: [
        { label: 'Max Health', value: '600', unit: '', icon: 'health', scaling: 'none', scalingValue: '0' },
        { label: 'Health Regen', value: '2', unit: '', icon: 'regen', scaling: 'none', scalingValue: '0' },
        { label: 'Bullet Resist', value: '0', unit: '%', icon: 'bullet_resist', scaling: 'none', scalingValue: '0' },
        { label: 'Spirit Resist', value: '0', unit: '%', icon: 'spirit_resist', scaling: 'none', scalingValue: '0' },
        { label: 'Move Speed', value: '7', unit: 'm/s', icon: 'move_speed', scaling: 'none', scalingValue: '0' },
        { label: 'Stamina', value: '3', unit: '', icon: 'stamina', scaling: 'none', scalingValue: '0' }
      ]
    }
    await VitalityStats.findOneAndUpdate({ heroId }, vitalityDoc, { upsert: true })

    // 5. Seed SpiritStats (including Melee Scaling)
    const spiritDoc = {
      heroId,
      topStats: [
        { label: 'Radius', value: '10', unit: 'm', icon: 'radius', scaling: 'none', scalingValue: '0' },
        { label: 'Duration', value: '4', unit: 's', icon: 'duration', scaling: 'none', scalingValue: '0' },
        { label: 'Healing per sec', value: '20', unit: '', icon: 'heal', scaling: 'none', scalingValue: '0' },
        { label: 'Melee Damage', value: '63', unit: '', icon: 'melee', scaling: 'melee', scalingValue: '1.2' }
      ],
      spiritPowerStat: { label: 'Spirit Power', value: '0', unit: '', icon: 'spirit', scaling: 'none', scalingValue: '0' }
    }
    await SpiritStats.findOneAndUpdate({ heroId }, spiritDoc, { upsert: true })

    console.log('Abrams seeded successfully!')
  } catch (err) {
    console.error('Seeding failed:', err)
  } finally {
    await conn.disconnect()
  }
}

run()

// @ts-nocheck
import { Types } from 'mongoose'
const dbConnect = require('../lib/dbConnect').default
const Hero = require('../lib/models/Hero').default
const HeroInfo = require('../lib/models/HeroInfo').default
const WeaponStats = require('../lib/models/WeaponStats').default
const VitalityStats = require('../lib/models/VitalityStats').default
const SpiritStats = require('../lib/models/SpiritStats').default

function stat(label, value = '0', unit = '', icon = 'dot', scaling = 'none', scalingValue = '0') {
  return { label, value: String(value), unit, icon, scaling, scalingValue }
}

async function run() {
  const conn = await dbConnect()

  try {
    console.log('Seeding Apollo data...')

    // 1. Find or Create Apollo Hero
    let apollo = await Hero.findOne({ slug: 'apollo' })
    if (!apollo) {
      apollo = await Hero.create({
        name: 'Apollo',
        slug: 'apollo',
        portrait: '/panorama/images/heroes/apollo.png',
        render: '/render/Apollo_Render.png',
        assetSlug: 'fencer',
        createdByUserId: 'system',
        status: 'published'
      })
    }
    const heroId = apollo._id

    // 2. Seed HeroInfo
    const infoDoc = {
      heroId,
      nameType: 'image',
      nameValue: '/panorama/images/heroes/hero_names/fencer.svg',
      nameColor: '#ffefd6',
      tag1Text: 'FINESSE',
      tag2Text: 'MOBILITY',
      tag3Text: 'A CUT ABOVE',
      tagColor: '#fe3435',
      tagTextColor: '#fef2d8',
      tag1Tilt: 2.1,
      tag2Tilt: 6.8,
      tag3Tilt: 4.9,
      tag1OffsetY: 0,
      tag2OffsetY: 3,
      tag3OffsetY: 2,
      ability1Icon: '/panorama/images/hud/abilities/fencer/1.png',
      ability2Icon: '/panorama/images/hud/abilities/fencer/2.png',
      ability3Icon: '/panorama/images/hud/abilities/fencer/3.png',
      ability4Icon: '/panorama/images/hud/abilities/fencer/4.png',
      abilityCircleColor: '#e3302d',
      abilityIconColor: '#3a0405',
      backstory: "Apollo, known in the underworld as 'The Fencer', is a master of the rapier and a practitioner of a forgotten school of combat that treats physics as a mere suggestion. A former aristocrat who grew bored of courtly life, he now seeks the ultimate challenge on the streets of the Citadel."
    }
    await HeroInfo.findOneAndUpdate({ heroId }, infoDoc, { upsert: true })

    // 3. Seed WeaponStats
    const weaponDoc = {
      heroId,
      weaponName: 'Dueling Rapier & Sidearm',
      weaponDesc: 'A pair of exquisitely crafted weapons designed for precision and flair.',
      gunImageSrc: '/panorama/images/hud/abilities/fencer/weapon.png',
      weaponAttributes: ['Precise', 'High Mobility', 'Fast Reload'],
      bulletDPS: 52,
      weaponMinRange: 15,
      weaponMaxRange: 45,
      stats: [
        stat('Bullet Damage', '18', '', 'bulletDamage'),
        stat('Weapon Damage', '0', '%', 'bulletDamage'),
        stat('Bullets per sec', '2.8', '', 'fireRate'),
        stat('Fire Rate', '0', '%', 'fireRate'),
        stat('Ammo', '12', '', 'ammoClipSize'),
        stat('Clip Size Increase', '0', '%', 'ammoClipSize'),
        stat('Reload Time', '1.2', 's', 'ammoReload'),
        stat('Reload Reduction', '0', '%', 'ammoReloadReduction'),
        stat('Bullet Velocity', '450', 'm/s', 'bulletVelocity'),
        stat('Bullet Velocity Increase', '0', '%', 'bulletVelocity'),
        stat('Bullet Lifesteal', '0', '%', 'healthStealBullets'),
        stat('Crit Bonus Scale', '0', '%', 'critBonusScale'),
        stat('Light Melee', '45', '', 'melee', 'melee', '0.8'),
        stat('Heavy Melee', '116', '', 'melee', 'melee', '0.8'),
      ]
    }
    await WeaponStats.findOneAndUpdate({ heroId }, weaponDoc, { upsert: true })

    // 4. Seed VitalityStats
    const vitalityDoc = {
      heroId,
      stats: [
        stat('Max Health', '450', '', 'maxHealth'),
        stat('Health Regen', '1.5', '', 'healthRegen'),
        stat('Heal Amp', '0', '%', 'healAmp'),
        stat('Non-Combat Regen', '0', '', 'healthRegen'),
        stat('Bullet Resist', '5', '%', 'bulletResist'),
        stat('Spirit Resist', '10', '%', 'spiritResist'),
        stat('Melee Resist', '0', '%', 'meleeResist'),
        stat('Debuff Resist', '0', '%', 'debuffResist'),
        stat('Crit Reduction', '0', '%', 'critReduction'),
        stat('Move Speed', '8.5', 'm', 'moveSpeed'),
        stat('Sprint Speed', '0', 'm', 'moveSprint'),
        stat('Stamina Cooldown', '0', 's', 'staminaRecovery'),
        stat('Stamina Recovery', '0', '%', 'staminaRecovery'),
        stat('Stamina', '4', '', 'stamina'),
        stat('Dash Speed', '0', 'm', 'stamina'),
      ]
    }
    await VitalityStats.findOneAndUpdate({ heroId }, vitalityDoc, { upsert: true })

    // 5. Seed SpiritStats
    const spiritDoc = {
      heroId,
      topStats: [
        stat('Ability Cooldown', '0', '%', 'abilityCooldown'),
        stat('Ability Duration', '2.5', '%', 'abilityDuration'),
        stat('Ability Range', '6', '%', 'abilityRange'),
        stat('Spirit Lifesteal', '0', '%', 'spiritLifesteal'),
        stat('Max Charges Increase', '0', '', 'maxCharges'),
        stat('Charge Cooldown', '0', '%', 'chargeCooldown'),
      ],
      spiritPowerStat: {
        ...stat('Spirit Power', '0', '', 'spiritPower'),
        description: 'Spirit Power increases the effectiveness of your Abilities and items.',
      }
    }
    await SpiritStats.findOneAndUpdate({ heroId }, spiritDoc, { upsert: true })

    console.log('Apollo seeded successfully!')
  } catch (err) {
    console.error('Seeding failed:', err)
  } finally {
    await conn.disconnect()
  }
}

run()

// @ts-nocheck
const dbConnect = require('../lib/dbConnect').default
const Hero = require('../lib/models/Hero').default
const WeaponStats = require('../lib/models/WeaponStats').default
const VitalityStats = require('../lib/models/VitalityStats').default
const SpiritStats = require('../lib/models/SpiritStats').default

function stat(label, value = '0', unit = '', icon = 'dot', scaling = 'none', scalingValue = '0') {
  return { label, value: String(value), unit, icon, scaling, scalingValue }
}

async function run() {
  const conn = await dbConnect()

  try {
    console.log('Seeding Corrected Abrams data...')

    let abrams = await Hero.findOne({ slug: 'abrams' })
    if (!abrams) {
      abrams = await Hero.create({
        name: 'Abrams',
        slug: 'abrams',
        assetSlug: 'abrams',
        portrait: '/panorama/images/heroes/abrams.png',
        render: '/render/Abrams_Render.png',
        createdByUserId: 'system',
        status: 'published'
      })
    }
    const heroId = abrams._id

    // 1. Weapon Stats
    const weaponDoc = {
      heroId,
      weaponName: 'Custom Shotgun',
      weaponDesc: 'A heavy-duty shotgun modified for close-quarters combat.',
      gunImageSrc: '/panorama/images/hud/abilities/abrams/weapon.png',
      weaponAttributes: ['Close Range', 'High Damage', 'Low Clip'],
      bulletDPS: 45,
      weaponMinRange: 8,
      weaponMaxRange: 30,
      stats: [
        stat('Bullet Damage', '30', '', 'bulletDamage'),
        stat('Weapon Damage', '0', '%', 'bulletDamage'),
        stat('Bullets per sec', '1.5', '', 'fireRate'),
        stat('Fire Rate', '0', '%', 'fireRate'),
        stat('Ammo', '6', '', 'ammoClipSize'),
        stat('Clip Size Increase', '0', '%', 'ammoClipSize'),
        stat('Reload Time', '2.1', 's', 'ammoReload'),
        stat('Reload Reduction', '0', '%', 'ammoReloadReduction'),
        stat('Bullet Velocity', '250', 'm/s', 'bulletVelocity'),
        stat('Bullet Velocity Increase', '0', '%', 'bulletVelocity'),
        stat('Bullet Lifesteal', '0', '%', 'healthStealBullets'),
        stat('Crit Bonus Scale', '0', '%', 'critBonusScale'),
        stat('Light Melee', '63', '', 'melee', 'melee', '1.2'),
        stat('Heavy Melee', '116', '', 'melee', 'melee', '1.2'),
      ]
    }
    await WeaponStats.findOneAndUpdate({ heroId }, weaponDoc, { upsert: true })

    // 2. Vitality Stats
    const vitalityDoc = {
      heroId,
      stats: [
        stat('Max Health', '600', '', 'maxHealth'),
        stat('Health Regen', '2', '', 'healthRegen'),
        stat('Heal Amp', '0', '%', 'healAmp'),
        stat('Non-Combat Regen', '0', '', 'healthRegen'),
        stat('Bullet Resist', '0', '%', 'bulletResist'),
        stat('Spirit Resist', '0', '%', 'spiritResist'),
        stat('Melee Resist', '0', '%', 'meleeResist'),
        stat('Debuff Resist', '0', '%', 'debuffResist'),
        stat('Crit Reduction', '0', '%', 'critReduction'),
        stat('Move Speed', '7', 'm', 'moveSpeed'),
        stat('Sprint Speed', '0', 'm', 'moveSprint'),
        stat('Stamina Cooldown', '0', 's', 'staminaRecovery'),
        stat('Stamina Recovery', '0', '%', 'staminaRecovery'),
        stat('Stamina', '3', '', 'stamina'),
        stat('Dash Speed', '0', 'm', 'stamina'),
      ]
    }
    await VitalityStats.findOneAndUpdate({ heroId }, vitalityDoc, { upsert: true })

    // 3. Spirit Stats
    const spiritDoc = {
      heroId,
      topStats: [
        stat('Ability Cooldown', '0', '%', 'abilityCooldown'),
        stat('Ability Duration', '4', '%', 'abilityDuration'),
        stat('Ability Range', '10', '%', 'abilityRange'),
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

    console.log('Abrams corrected successfully!')
  } catch (err) {
    console.error('Seeding failed:', err)
  } finally {
    await conn.disconnect()
  }
}

run()

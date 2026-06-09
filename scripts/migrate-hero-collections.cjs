const dbConnect = require('../lib/dbConnect').default

async function run() {
  const write = process.argv.includes('--write')
  const conn = await dbConnect()
  const db = conn.connection.db
  const officialHeroes = db.collection('heroes')
  const legacyCustomHeroes = db.collection('heros')
  const customHeroes = db.collection('customheroes')

  try {
    const officialDocs = await officialHeroes.find({}).project({ slug: 1 }).toArray()
    const officialSlugs = new Set(officialDocs.map(hero => hero.slug).filter(Boolean))
    const legacyDocs = await legacyCustomHeroes.find({}).toArray()
    const duplicateOfficialDocs = legacyDocs.filter(hero => officialSlugs.has(hero.slug))
    const customDocs = legacyDocs.filter(hero => !officialSlugs.has(hero.slug))
    const existingCustomOfficialDocs = await customHeroes.find({ slug: { $in: Array.from(officialSlugs) } }).project({ _id: 1, slug: 1 }).toArray()

    console.log(`Mode: ${write ? 'write' : 'dry-run'}`)
    console.log(`Official heroes in heroes: ${officialDocs.length}`)
    console.log(`Legacy custom docs in heros: ${legacyDocs.length}`)
    console.log(`Custom docs to copy into customheroes: ${customDocs.length}`)
    console.log(`Official duplicates to remove from heros: ${duplicateOfficialDocs.length}`)
    console.log(`Official duplicates to remove from customheroes: ${existingCustomOfficialDocs.length}`)

    if (!write) {
      console.log('Dry-run only. Re-run with --write to copy/delete documents.')
      return
    }

    if (customDocs.length) {
      await Promise.all(customDocs.map(hero => customHeroes.updateOne({ _id: hero._id }, { $set: hero }, { upsert: true })))
    }

    if (duplicateOfficialDocs.length) {
      await legacyCustomHeroes.deleteMany({ _id: { $in: duplicateOfficialDocs.map(hero => hero._id) } })
    }

    if (existingCustomOfficialDocs.length) {
      await customHeroes.deleteMany({ _id: { $in: existingCustomOfficialDocs.map(hero => hero._id) } })
    }

    console.log('Hero collection migration complete.')
  } finally {
    await conn.disconnect()
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})

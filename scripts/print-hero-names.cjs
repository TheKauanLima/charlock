const fs = require('fs')
const dns = require('dns')
const path = require('path')
const mongoose = require('mongoose')

function readEnvLocal(pathFile = '.env.local') {
  if (!fs.existsSync(pathFile)) return {}
  const content = fs.readFileSync(pathFile, 'utf8')
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

function parseSrvUri(uri) {
  const m = uri.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/?([^?]*)\??(.*)$/)
  if (!m) throw new Error('Not a valid mongodb+srv URI')
  return { user: m[1], pass: m[2], host: m[3], db: m[4], opts: m[5] }
}

async function resolveSrvHost(host) {
  const resolver = new dns.Resolver()
  resolver.setServers(['8.8.8.8'])
  return new Promise((resolve, reject) => {
    resolver.resolveSrv(`_mongodb._tcp.${host}`, (err, records) => {
      if (err) return reject(err)
      resolve(records)
    })
  })
}

function buildNonSrvUri(parsed, srvRecords) {
  const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',')
  const auth = parsed.user ? `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}@` : ''
  const opts = parsed.opts ? parsed.opts : ''
  const map = {}
  if (opts) for (const part of opts.split('&')) { const [k,v]=part.split('='); if (k) map[k]=v===undefined?'':v }
  const requiredMap = { ssl: 'true', authSource: 'admin', retryWrites: 'true', w: 'majority' }
  for (const [k,v] of Object.entries(requiredMap)) if (!(k in map)) map[k]=v
  const qs = '?' + Object.entries(map).map(([k,v])=>`${k}=${v}`).join('&')
  const dbPath = parsed.db ? `/${parsed.db}` : ''
  return `mongodb://${auth}${hosts}${dbPath}${qs}`
}

async function obtainConnectionString() {
  const env = readEnvLocal('.env.local')
  const raw = process.env.MONGODB_URI || env.MONGODB_URI
  if (!raw) throw new Error('MONGODB_URI not found in env or .env.local')
  if (!raw.startsWith('mongodb+srv://')) return raw
  const parsed = parseSrvUri(raw)
  const srv = await resolveSrvHost(parsed.host)
  return buildNonSrvUri(parsed, srv)
}

async function run() {
  const connStr = await obtainConnectionString()
  await mongoose.connect(connStr, { bufferCommands: false })
  const collection = mongoose.connection.collection('heroinfos')

  const total = await collection.countDocuments()
  console.log('Total HeroInfo documents:', total)

  const holliday = await collection.findOne({ nameValue: /holliday/i })
  const venator = await collection.findOne({ nameValue: /venator/i })

  console.log('Holliday doc:', holliday ? { _id: holliday._id, nameValue: holliday.nameValue } : 'not found')
  console.log('Venator doc:', venator ? { _id: venator._id, nameValue: venator.nameValue } : 'not found')

  // show a small sample
  const sample = await collection.find().limit(6).toArray()
  console.log('Sample docs:')
  for (const d of sample) console.log({ _id: d._id, nameValue: d.nameValue })

  await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })

import mongoose, { Mongoose } from 'mongoose'

let MONGODB_URI = process.env.MONGODB_URI

type Cached = {
  conn: Mongoose | null
  promise: Promise<Mongoose> | null
}

declare global {
  var _mongoose: Cached | undefined
}

const cached: Cached = globalThis._mongoose ?? { conn: null, promise: null }

export async function dbConnect(): Promise<Mongoose> {
  if (!MONGODB_URI) {
    MONGODB_URI = process.env.MONGODB_URI
  }

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable')
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
      })
      .then(m => m)
  }

  try {
    cached.conn = await cached.promise
    globalThis._mongoose = cached
    return cached.conn
  } catch {
    cached.promise = null
    throw new Error('Failed to connect to MongoDB')
  }
}

export default dbConnect

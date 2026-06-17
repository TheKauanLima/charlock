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
globalThis._mongoose = cached

export class DatabaseConnectionError extends Error {
  constructor(message = 'Failed to connect to MongoDB') {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

export function isDatabaseConnectionError(error: unknown) {
  return error instanceof DatabaseConnectionError
    || (error instanceof Error && (
      error.message.includes('Failed to connect to MongoDB')
      || error.message.includes('before initial connection is complete')
    ))
}

export async function dbConnect(): Promise<Mongoose> {
  if (!MONGODB_URI) {
    MONGODB_URI = process.env.MONGODB_URI
  }

  if (!MONGODB_URI) {
    throw new DatabaseConnectionError('Please define the MONGODB_URI environment variable')
  }

  if (cached.conn?.connection.readyState === 1) {
    return cached.conn
  }

  if (cached.conn) {
    cached.conn = null
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      })
      .then(m => m)
  }

  try {
    cached.conn = await cached.promise
    globalThis._mongoose = cached
    return cached.conn
  } catch {
    cached.conn = null
    cached.promise = null
    throw new DatabaseConnectionError()
  }
}

export default dbConnect

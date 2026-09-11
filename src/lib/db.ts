import mongoose from "mongoose"
import { env } from "@/config/env"

// Global Mongoose cache reference to prevent connection leaks in hot-reloading dev environments
interface GlobalMongoose {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseGlobal: GlobalMongoose | undefined
}

const cached: GlobalMongoose = globalThis.mongooseGlobal || { conn: null, promise: null }

if (!globalThis.mongooseGlobal) {
  globalThis.mongooseGlobal = cached
}

/**
 * Connects to MongoDB (saved prompts and the About Me profile), reusing one connection.
 */
export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Connection timeout threshold to fail fast if database is offline
    }

    cached.promise = mongoose.connect(env.MONGODB_URI, opts).then((m) => {
      console.log("💚 MongoDB connected successfully!")
      return m
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error("❌ MongoDB connection failed:", e)
    throw e
  }

  return cached.conn
}

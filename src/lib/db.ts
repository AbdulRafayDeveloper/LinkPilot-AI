import mongoose from "mongoose"
import { env } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { withRetry } from "@/lib/retry"
import { isTransientError } from "@/lib/transientErrors"

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

// A dropped or slow first connection (a cold start, a network blip) gets this many more tries, with backoff
const CONNECT_RETRIES = 2

/**
 * Connects to MongoDB (prompts, Trending history, Dummy Data and every tool's saved outputs), reusing one connection. A
 * transient connection failure is retried with backoff; a failed connection is never cached,
 * so the next request tries again. Once connected, the driver retries reads and writes itself.
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

    cached.promise = withRetry(() => mongoose.connect(env.MONGODB_URI, opts), {
      retries: CONNECT_RETRIES,
      shouldRetry: isTransientError,
      baseDelayMs: 500,
      onRetry: (error, attempt, delayMs) =>
        console.warn(`↻ MongoDB connection failed (${error instanceof Error ? error.message : error}); retry ${attempt} in ${delayMs}ms`),
    }).then((m) => {
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

/**
 * connectDB for request handlers: a failed connection becomes a message the user can act on.
 */
export async function connectDatabase() {
  try {
    return await connectDB()
  } catch {
    throw new UserFacingError("The database is unavailable. Check MONGODB_URI and try again.")
  }
}

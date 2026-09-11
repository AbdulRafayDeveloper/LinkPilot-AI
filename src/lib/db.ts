import mongoose from "mongoose"
import { env } from "@/config/env"

const MONGODB_URI = env.MONGODB_URI

// Global Mongoose cache reference to prevent connection leaks in hot-reloading dev environments
interface GlobalMongoose {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseGlobal: GlobalMongoose | undefined
}

let cached: GlobalMongoose = globalThis.mongooseGlobal || { conn: null, promise: null }

if (!globalThis.mongooseGlobal) {
  globalThis.mongooseGlobal = cached
}

import { ChromaClient } from "chromadb"

let startupCheckRun = false

async function runStartupChecks() {
  if (startupCheckRun) return
  startupCheckRun = true

  try {
    const isCloud = Boolean(env.CHROMA_API_KEY && env.CHROMA_TENANT && env.CHROMA_DATABASE)
    let host = "localhost"
    let port = 8000
    let ssl = false

    try {
      const url = new URL(env.CHROMA_URL)
      host = url.hostname
      port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80)
      ssl = url.protocol === "https:"
    } catch (e) {}

    const client = new ChromaClient({
      host,
      port,
      ssl,
      tenant: env.CHROMA_TENANT || undefined,
      database: env.CHROMA_DATABASE || undefined,
      headers: env.CHROMA_API_KEY ? { "x-chroma-token": env.CHROMA_API_KEY } : undefined,
    })

    await client.heartbeat()
    console.log("💚 ChromaDB connected successfully!")
  } catch (err: any) {
    console.warn("⚠️ ChromaDB connection check failed (server offline or misconfigured):", err?.message || err)
  }
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Connection timeout threshold to fail fast if database is offline
    }

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      console.log("💚 MongoDB connected successfully!")
      return m
    })
  }

  try {
    cached.conn = await cached.promise
    runStartupChecks().catch(() => {})
  } catch (e) {
    cached.promise = null
    console.error("❌ MongoDB connection failed:", e)
    throw e
  }

  return cached.conn
}

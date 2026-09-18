import { createHash } from "node:crypto"
import { GROQ_API_KEYS } from "@/config/env"
import { connectDB } from "@/lib/db"
import { ProviderKeyStateModel } from "@/models/ProviderKeyState"

/**
 * The one shared answer to "which Groq key do we use now", for every module and every server instance.
 *
 * Every Groq call starts on the active key (the one that answered last) and goes round from there, so
 * once keys 1 to 3 are used up and key 4 is answering, every call goes straight to key 4 instead of
 * asking 1, 2 and 3 again first. The state lives in memory for speed and in MongoDB
 * (`provider_key_states`) so that a new or different server instance (Vercel runs many) knows it too:
 * it is read again at most every REFRESH_MS, and written only when something changes (a key is set
 * aside, or a different key starts answering), never on an ordinary call.
 *
 * A database that can't be reached never stops a call: this process keeps its own copy and carries on.
 */

const PROVIDER = "groq"
// How stale this process's copy may get before it is read from the database again
const REFRESH_MS = 15_000

const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16)
const fingerprints = GROQ_API_KEYS.map((key) => fingerprint(key.value))

const shared = {
  active: 0,
  resting: new Map<number, number>(),
  readAt: 0,
}
let reading: Promise<void> | null = null

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function readShared(): Promise<void> {
  shared.readAt = Date.now()
  try {
    await connectDB()
    const state = await ProviderKeyStateModel.findOne({ provider: PROVIDER }).lean()
    if (!state) return
    const rests = state.rests instanceof Map ? Object.fromEntries(state.rests) : (state.rests as Record<string, number> | undefined) ?? {}
    shared.resting = new Map(
      fingerprints.flatMap((key, index) => (typeof rests[key] === "number" ? [[index, rests[key]] as [number, number]] : []))
    )
    const active = state.activeKey ? fingerprints.indexOf(state.activeKey) : -1
    if (active >= 0) shared.active = active
  } catch (error: unknown) {
    console.warn(`🔑 Groq key state could not be read (${describe(error)}); this server keeps its own`)
  }
}

async function write(update: Record<string, unknown>): Promise<void> {
  try {
    await connectDB()
    await ProviderKeyStateModel.updateOne({ provider: PROVIDER }, update, { upsert: true })
  } catch (error: unknown) {
    console.warn(`🔑 Groq key state could not be saved (${describe(error)}); this server keeps its own`)
  }
}

/** Where a Groq call starts, and which keys are resting: read from the shared state when it is stale. */
export async function groqKeyPlan(): Promise<{ start: number; resting: Map<number, number> }> {
  if (Date.now() - shared.readAt > REFRESH_MS) {
    reading ??= readShared().finally(() => {
      reading = null
    })
    await reading
  }
  return { start: shared.active, resting: shared.resting }
}

/** A key was refused for a reason of its own: every instance sets it aside until `until`. */
export async function noteGroqKeyResting(index: number, until: number): Promise<void> {
  shared.resting.set(index, until)
  await write({ $set: { [`rests.${fingerprints[index]}`]: until } })
}

/** A key answered. When it is not already the active one, it becomes the key every call starts from. */
export async function noteGroqKeyAnswered(index: number, wasResting: boolean): Promise<void> {
  shared.resting.delete(index)
  if (shared.active === index && !wasResting) return
  shared.active = index
  await write({ $set: { activeKey: fingerprints[index] }, $unset: { [`rests.${fingerprints[index]}`]: "" } })
}

/** The number of the key calls start from now (GROQ_API_KEY_<n>), for the status page; null with no keys. */
export async function activeGroqKeyNumber(): Promise<number | null> {
  if (GROQ_API_KEYS.length === 0) return null
  const { start } = await groqKeyPlan()
  return GROQ_API_KEYS[start]?.number ?? null
}

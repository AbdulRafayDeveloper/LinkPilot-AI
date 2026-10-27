import { createHash } from "node:crypto"
import { startKeyFor } from "@/lib/keyRotation"
import { connectDB } from "@/lib/db"
import { ProviderKeyStateModel } from "@/models/ProviderKeyState"

/**
 * The one shared answer to "which of this provider's keys do we use now", for every module and every
 * server instance. Groq's keys and Gemini's keys each have one (services/groqKeyState.ts,
 * services/embeddings/geminiKeyState.ts); the rules are the same for both.
 *
 * Every call starts on the key **after** the one that answered last and goes round from there
 * (`startKeyFor`), so the work is spread over the accounts a key at a time rather than one account
 * being drained; keys that are resting are still tried last, so a used-up key never costs a call
 * anything. The state lives in memory for speed and in MongoDB (`provider_key_states`, one document
 * per provider) so that a new or different server instance (Vercel runs many) knows it too: it is read
 * again at most every REFRESH_MS, and written only when something changes (a key is set aside, or a
 * different key starts answering), never on an ordinary call.
 *
 * A database that can't be reached never stops a call: this process keeps its own copy and carries on.
 * Keys are named by a short fingerprint, never their value or their number.
 */

// How stale this process's copy may get before it is read from the database again
const REFRESH_MS = 15_000

const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16)
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

export interface ProviderKeyState {
  // Where a call starts, and which keys are resting: read from the shared state when it is stale
  plan: () => Promise<{ start: number; resting: Map<number, number> }>
  // A key was refused for a reason of its own: every instance sets it aside until `until`
  noteResting: (index: number, until: number) => Promise<void>
  // A key answered; when it is not already the active one, it becomes the key calls start from
  noteAnswered: (index: number, wasResting: boolean) => Promise<void>
  // The number of the key the next call starts on (<PREFIX><n>), or null with no keys
  activeKeyNumber: () => Promise<number | null>
}

/** The shared key state of one provider. `label` only names it in the logs. */
export function createProviderKeyState(provider: string, label: string, keys: readonly { number: number; value: string }[]): ProviderKeyState {
  const fingerprints = keys.map((key) => fingerprint(key.value))
  const shared = { active: 0, resting: new Map<number, number>(), readAt: 0 }
  let reading: Promise<void> | null = null

  async function readShared(): Promise<void> {
    shared.readAt = Date.now()
    try {
      await connectDB()
      const state = await ProviderKeyStateModel.findOne({ provider }).lean()
      if (!state) return
      const rests = state.rests instanceof Map ? Object.fromEntries(state.rests) : ((state.rests as Record<string, number> | undefined) ?? {})
      shared.resting = new Map(fingerprints.flatMap((key, index) => (typeof rests[key] === "number" ? [[index, rests[key]] as [number, number]] : [])))
      const active = state.activeKey ? fingerprints.indexOf(state.activeKey) : -1
      if (active >= 0) shared.active = active
    } catch (error: unknown) {
      console.warn(`🔑 ${label} key state could not be read (${describe(error)}); this server keeps its own`)
    }
  }

  async function write(update: Record<string, unknown>): Promise<void> {
    try {
      await connectDB()
      await ProviderKeyStateModel.updateOne({ provider }, update, { upsert: true })
    } catch (error: unknown) {
      console.warn(`🔑 ${label} key state could not be saved (${describe(error)}); this server keeps its own`)
    }
  }

  async function plan() {
    if (Date.now() - shared.readAt > REFRESH_MS) {
      reading ??= readShared().finally(() => {
        reading = null
      })
      await reading
    }
    return { start: shared.active, resting: shared.resting }
  }

  return {
    plan,
    async noteResting(index, until) {
      shared.resting.set(index, until)
      await write({ $set: { [`rests.${fingerprints[index]}`]: until } })
    },
    async noteAnswered(index, wasResting) {
      shared.resting.delete(index)
      if (shared.active === index && !wasResting) return
      shared.active = index
      await write({ $set: { activeKey: fingerprints[index] }, $unset: { [`rests.${fingerprints[index]}`]: "" } })
    },
    async activeKeyNumber() {
      if (keys.length === 0) return null
      const { start } = await plan()
      return keys[startKeyFor(start, 0, keys.length)]?.number ?? null
    },
  }
}

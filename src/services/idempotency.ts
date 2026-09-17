import { NextResponse, type NextRequest } from "next/server"
import { connectDatabase } from "@/lib/db"
import { IdempotencyKey } from "@/models/IdempotencyKey"
import { getViewer } from "@/services/auth/viewer"
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENCY_MESSAGES,
  IDEMPOTENT_REPLAY_HEADER,
} from "@/constants/idempotency"

/**
 * Makes a route that creates something safe to retry (constants/idempotency.ts).
 *
 * A request with an Idempotency-Key runs once per account, route and key:
 * - The first attempt claims the key and runs. A successful (2xx) answer is kept.
 * - A repeat after that gets the kept answer back, marked Idempotent-Replayed, without running.
 * - A repeat while the first is still running gets 503 with Retry-After, which the browser retries.
 * - A failed answer (a 4xx the user will correct, a cancelled 499, a 5xx) or a thrown error releases
 *   the key, so the next attempt runs again instead of being locked out.
 * A request without the header runs exactly as it did before, and a signed-out request always goes
 * straight to the route, which refuses it, so a stored answer is never given to someone signed out.
 */

// Longer than any route's maxDuration (300s), so a claim this old belongs to an attempt that died
const ABANDONED_AFTER_MS = 6 * 60 * 1000
// A kept answer is small JSON; anything larger is marked done without its body
const MAX_STORED_BODY_CHARS = 512_000
const DUPLICATE_KEY = 11000

type Claim = { kind: "run" } | { kind: "busy" } | { kind: "replay"; status: number; body: string | null }

const isDuplicateKey = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === DUPLICATE_KEY

async function claim(ownerId: string, route: string, key: string, attempt = 0): Promise<Claim> {
  try {
    await IdempotencyKey.create({ ownerId, route, key, state: "pending" })
    return { kind: "run" }
  } catch (error: unknown) {
    if (!isDuplicateKey(error)) throw error
  }

  const existing = await IdempotencyKey.findOne({ ownerId, route, key }).lean()
  // Released between the insert and this read: try the claim once more
  if (!existing) return attempt === 0 ? claim(ownerId, route, key, 1) : { kind: "busy" }
  if (existing.state === "done") return { kind: "replay", status: existing.status ?? 200, body: existing.body }

  // Still running, unless the attempt that claimed it died without answering; then this one takes over
  if (Date.now() - new Date(existing.updatedAt).getTime() > ABANDONED_AFTER_MS) {
    const taken = await IdempotencyKey.findOneAndUpdate(
      { _id: existing._id, state: "pending", updatedAt: existing.updatedAt },
      { $set: { updatedAt: new Date() } }
    )
    if (taken) return { kind: "run" }
  }
  return { kind: "busy" }
}

const release = (ownerId: string, route: string, key: string) =>
  IdempotencyKey.deleteOne({ ownerId, route, key, state: "pending" }).catch((error: unknown) =>
    console.warn("⚠️ Couldn't release an idempotency key:", error instanceof Error ? error.message : error)
  )

function replay(status: number, body: string | null): Response {
  if (body === null) {
    return NextResponse.json({ success: false, message: IDEMPOTENCY_MESSAGES.alreadyDone }, { status: 409, headers: { [IDEMPOTENT_REPLAY_HEADER]: "true" } })
  }
  return new NextResponse(body, { status, headers: { "Content-Type": "application/json", [IDEMPOTENT_REPLAY_HEADER]: "true" } })
}

export function withIdempotency<Context>(route: string, handler: (req: NextRequest, context: Context) => Promise<Response>) {
  return async (req: NextRequest, context: Context): Promise<Response> => {
    const key = req.headers.get(IDEMPOTENCY_HEADER)
    if (key === null) return handler(req, context)
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      return NextResponse.json({ success: false, message: IDEMPOTENCY_MESSAGES.badKey }, { status: 400 })
    }
    // The route answers a signed-out request itself; a key only ever belongs to a signed-in account
    const viewer = await getViewer().catch(() => null)
    if (!viewer) return handler(req, context)

    await connectDatabase()
    const claimed = await claim(viewer.id, route, key)
    if (claimed.kind === "replay") return replay(claimed.status, claimed.body)
    if (claimed.kind === "busy") {
      return NextResponse.json({ success: false, message: IDEMPOTENCY_MESSAGES.stillRunning }, { status: 503, headers: { "Retry-After": "2" } })
    }

    let response: Response
    try {
      response = await handler(req, context)
    } catch (error: unknown) {
      await release(viewer.id, route, key)
      throw error
    }
    if (!response.ok) {
      await release(viewer.id, route, key)
      return response
    }

    try {
      const body = await response.clone().text()
      await IdempotencyKey.updateOne(
        { ownerId: viewer.id, route, key },
        { $set: { state: "done", status: response.status, body: body.length <= MAX_STORED_BODY_CHARS ? body : null } }
      )
    } catch (error: unknown) {
      // The request itself succeeded; losing the stored answer only means a repeat would run again
      console.warn("⚠️ Couldn't keep an idempotent answer:", error instanceof Error ? error.message : error)
      await release(viewer.id, route, key)
    }
    return response
  }
}

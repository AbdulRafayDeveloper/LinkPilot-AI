import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  CLIENT_MESSAGING_MESSAGES,
  MESSAGE_CHANNEL_IDS,
  UPDATE_MAX_LENGTH,
} from "@/constants/clientMessaging"
import { requireClient } from "@/services/clientMessaging/clients"
import { generateClientMessage } from "@/services/clientMessaging/generate"
import { saveClientMessage } from "@/services/clientMessaging/records"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  clientId: z.string({ error: CLIENT_MESSAGING_MESSAGES.missingClient }).trim().min(1, CLIENT_MESSAGING_MESSAGES.missingClient),
  update: z
    .string({ error: CLIENT_MESSAGING_MESSAGES.missingUpdate })
    .trim()
    .min(1, CLIENT_MESSAGING_MESSAGES.missingUpdate)
    .max(UPDATE_MAX_LENGTH, CLIENT_MESSAGING_MESSAGES.updateTooLong),
  channel: z.enum(MESSAGE_CHANNEL_IDS, { error: CLIENT_MESSAGING_MESSAGES.missingChannel }),
})

/**
 * POST: Writes one formal message for a client, in that client's own format and shaped for the
 * chosen channel, and saves it with the client it was written for.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CLIENT_MESSAGING_MESSAGES.missingUpdate },
        { status: 400 }
      )
    }

    const { clientId, update, channel } = parsed.data
    const client = await requireClient(auth.viewer, clientId)
    const result = withSource(await runAiRequest(auth.viewer, "client-messaging", () => generateClientMessage({ client, update, channel, signal: req.signal })))
    const saved = await saveClientMessage(auth.viewer, client, update, result)
    return NextResponse.json({ success: true, message: "Message written", data: saved })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Client Message Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, CLIENT_MESSAGING_MESSAGES.generationFailed)
    // 503 lets the browser retry a provider outage on its own (lib/apiClient.ts)
    const status =
      message === CLIENT_MESSAGING_MESSAGES.clientNotFound
        ? 404
        : message === CLIENT_MESSAGING_MESSAGES.providerUnavailable
          ? 503
          : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("client-messaging:generate", handlePost)

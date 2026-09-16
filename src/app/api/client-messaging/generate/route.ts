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
export async function POST(req: NextRequest) {
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
    const client = await requireClient(clientId)
    const result = await generateClientMessage({ client, update, channel, signal: req.signal })
    const saved = await saveClientMessage(client, update, result)
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

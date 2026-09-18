import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientSchema } from "@/lib/validation/client"
import { CLIENTS_MESSAGES } from "@/constants/clients"
import { createClient, listClients } from "@/services/clientMessaging/clients"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * The Clients Management module's own routes. They read and write the same records the Client Tasks
 * Messaging routes always have (`/api/client-messaging/clients`, still answering exactly as before),
 * through the same service, so the two never disagree about a client.
 */

/** GET: Every client of this account, oldest first, with their message format and sample messages. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const clients = await listClients(auth.viewer)
    return NextResponse.json({ success: true, message: "Clients retrieved", data: clients })
  } catch (error: unknown) {
    console.error("GET Clients Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST: Adds a client. */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENTS_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const client = await createClient(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: `${client.name} added.`, data: client }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Client Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of adding two
export const POST = withIdempotency("clients", handlePost)

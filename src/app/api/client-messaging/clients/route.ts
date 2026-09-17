import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientSchema } from "@/lib/validation/client"
import { CLIENT_MESSAGING_MESSAGES } from "@/constants/clientMessaging"
import { createClient, listClients } from "@/services/clientMessaging/clients"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * GET: Every client, oldest first, with their message format and sample messages. Open like
 * the generation routes, because the page needs the list to write a message at all; adding,
 * changing and removing clients stays behind the prompt password.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const clients = await listClients(auth.viewer)
    return NextResponse.json({ success: true, message: "Clients retrieved", data: clients })
  } catch (error: unknown) {
    console.error("GET Clients Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CLIENT_MESSAGING_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * POST: Adds a client.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const body = await req.json().catch(() => null)
    const parsed = ClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CLIENT_MESSAGING_MESSAGES.saveFailed },
        { status: 400 }
      )
    }

    const client = await createClient(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: `${client.name} added.`, data: client }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Client Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CLIENT_MESSAGING_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("client-messaging:clients", handlePost)

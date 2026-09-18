import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientSchema } from "@/lib/validation/client"
import { CLIENTS_MESSAGES } from "@/constants/clients"
import { deleteClient, getClient, updateClient } from "@/services/clientMessaging/clients"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: CLIENTS_MESSAGES.notFound }, { status: 404 })

/** GET: One client. Another account's client, or an id that isn't one, reads as not found. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const client = await getClient(auth.viewer, (await params).id)
    return client ? NextResponse.json({ success: true, message: "Client retrieved", data: client }) : notFound()
  } catch (error: unknown) {
    console.error("GET Client Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** PUT: Replaces one client's name, country, message format and sample messages. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENTS_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const client = await updateClient(auth.viewer, (await params).id, parsed.data)
    return client ? NextResponse.json({ success: true, message: `${client.name} saved.`, data: client }) : notFound()
  } catch (error: unknown) {
    console.error("PUT Client Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/**
 * DELETE: Removes one client and the projects being done for them. Messages already written for
 * them stay in the history. The page confirms first.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteClient(auth.viewer, (await params).id)
    return removed ? NextResponse.json({ success: true, message: CLIENTS_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Client Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientSchema } from "@/lib/validation/client"
import { CLIENT_MESSAGING_MESSAGES } from "@/constants/clientMessaging"
import { deleteClient, updateClient } from "@/services/clientMessaging/clients"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT: Replaces one client's details. The other clients are untouched.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CLIENT_MESSAGING_MESSAGES.saveFailed },
        { status: 400 }
      )
    }

    const client = await updateClient(auth.viewer, (await params).id, parsed.data)
    if (!client) {
      return NextResponse.json({ success: false, message: CLIENT_MESSAGING_MESSAGES.clientNotFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: `${client.name} saved.`, data: client })
  } catch (error: unknown) {
    console.error("PUT Client Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CLIENT_MESSAGING_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes one client. Messages already written for them stay in the history.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteClient(auth.viewer, (await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: CLIENT_MESSAGING_MESSAGES.clientNotFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Client removed.", data: null })
  } catch (error: unknown) {
    console.error("DELETE Client Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CLIENT_MESSAGING_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientOrderSchema } from "@/lib/validation/client"
import { CLIENTS_MESSAGES } from "@/constants/clients"
import { reorderClients } from "@/services/clientMessaging/clients"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT (body: { orderedIds }): The clients in their new order after a drag, every one top to bottom.
 * An order that no longer names all of them (one was added or deleted elsewhere) answers 409 and the
 * page reads the list again. Sending the same order twice lands on the same order.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENTS_MESSAGES.orderFailed }, { status: 400 })
  }
  try {
    const result = await reorderClients(auth.viewer, parsed.data.orderedIds)
    if (result === "changed") return NextResponse.json({ success: false, message: CLIENTS_MESSAGES.orderChanged }, { status: 409 })
    return NextResponse.json({ success: true, message: "Client order saved", data: { saved: parsed.data.orderedIds.length } })
  } catch (error: unknown) {
    console.error("PUT Clients Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENTS_MESSAGES.orderFailed) }, { status: 500 })
  }
}

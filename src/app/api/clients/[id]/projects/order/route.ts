import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientProjectOrderSchema } from "@/lib/validation/clientProject"
import { CLIENTS_MESSAGES, CLIENT_PROJECT_MESSAGES } from "@/constants/clients"
import { reorderClientProjects } from "@/services/clients/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT (body: { orderedIds }): One client's projects in their new order after a drag, every project top
 * to bottom. An order that no longer names all of them (one was added or deleted elsewhere) answers
 * 409 and the page reads the list again; a client the viewer may not see answers 404.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientProjectOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_PROJECT_MESSAGES.orderFailed }, { status: 400 })
  }
  try {
    const result = await reorderClientProjects(auth.viewer, (await params).id, parsed.data.orderedIds)
    if (result === null) return NextResponse.json({ success: false, message: CLIENTS_MESSAGES.notFound }, { status: 404 })
    if (result === "changed") return NextResponse.json({ success: false, message: CLIENT_PROJECT_MESSAGES.orderChanged }, { status: 409 })
    return NextResponse.json({ success: true, message: "Project order saved", data: { saved: parsed.data.orderedIds.length } })
  } catch (error: unknown) {
    console.error("PUT Client Projects Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.orderFailed) }, { status: 500 })
  }
}

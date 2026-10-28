import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AllProjectsOrderSchema } from "@/lib/validation/clientProject"
import { CLIENT_PROJECT_MESSAGES } from "@/constants/clients"
import { reorderAllProjects } from "@/services/clientProjects/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT (body: { orderedIds }): Every project on Projects Management in its new order after a drag, every one top to bottom.
 * An order that no longer names all of them (a project was added or deleted elsewhere) answers 409 and the
 * page reads the list again. Sending the same order twice lands on the same order.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = AllProjectsOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_PROJECT_MESSAGES.orderFailed }, { status: 400 })
  }
  try {
    const result = await reorderAllProjects(auth.viewer, parsed.data.orderedIds)
    if (result === "changed") return NextResponse.json({ success: false, message: CLIENT_PROJECT_MESSAGES.orderChanged }, { status: 409 })
    return NextResponse.json({ success: true, message: "Project order saved", data: { saved: parsed.data.orderedIds.length } })
  } catch (error: unknown) {
    console.error("PUT Client Projects Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.orderFailed) }, { status: 500 })
  }
}

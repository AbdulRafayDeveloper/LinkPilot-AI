import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { PublicProjectOrderSchema } from "@/lib/validation/clientProjectTasks"
import { orderPublicProjectTasks } from "@/services/clientProjects/publicTasks"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ token: string }> }

const noStore = { "Cache-Control": "no-store" }

/**
 * PUT `{ kind, orderedIds }`: the client puts one tab in the order they want it worked in.
 *
 * It is its own path rather than another shape of the project's own PUT, which names one item in
 * its body; everything else is the same as the owner's: the token is resolved afresh, so turning
 * the link off stops this with the reads, and the write is held to the tabs the link may see, so an
 * order naming a credential or a backup writes nothing.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const parsed = PublicProjectOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.reorderFailed }, { status: 400, headers: noStore })
  }
  try {
    const saved = await orderPublicProjectTasks(token, parsed.data.kind, parsed.data.orderedIds)
    if (saved.ok) return NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.saved, data: { ordered: parsed.data.orderedIds.length } }, { headers: noStore })
    // A refusal about the link always reads the same; an order that moved on says so instead
    return saved.reason === "link"
      ? NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })
      : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.staleOrder }, { status: 409, headers: noStore })
  } catch (error: unknown) {
    console.error("PUT Public Project Task Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.reorderFailed) }, { status: 500, headers: noStore })
  }
}

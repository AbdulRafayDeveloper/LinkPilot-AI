import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ProjectOrderSchema } from "@/lib/validation/clientProjectTasks"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { orderProjectTasks } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT `{ kind, orderedIds }`: puts one tab of a project in the order a drag left it.
 *
 * It writes the items named into the places those items already hold, so a tab with folders can be
 * ordered inside one folder without disturbing the others. An order naming something that is not on
 * that tab of that project writes nothing at all and answers 409, which the page takes as "this
 * list moved on" and reads it again.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProjectOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.reorderFailed }, { status: 400 })
  }
  try {
    const saved = await orderProjectTasks(auth.viewer, (await params).id, parsed.data.kind, parsed.data.orderedIds)
    return saved
      ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.saved, data: { ordered: parsed.data.orderedIds.length } })
      : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.staleOrder }, { status: 409 })
  } catch (error: unknown) {
    console.error("PUT Client Project Task Order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.reorderFailed) }, { status: 500 })
  }
}

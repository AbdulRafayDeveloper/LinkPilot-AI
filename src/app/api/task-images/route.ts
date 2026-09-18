import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import { TaskImageUploadSchema } from "@/lib/validation/taskAttachment"
import { planTaskImageUpload } from "@/services/taskImages"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST { contentType, size }: a link the browser may PUT one task image to, and the id to save on
 * the task afterwards. The image itself never passes through the app.
 *
 * It is not wrapped in withIdempotency: a repeat only hands out another link, which costs nothing
 * and is never written anywhere until a task is actually saved with it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = TaskImageUploadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || TASK_ATTACHMENT_MESSAGES.uploadFailed }, { status: 400 })
  }
  try {
    const plan = await planTaskImageUpload(parsed.data.contentType, parsed.data.size)
    return NextResponse.json({ success: true, message: "Upload ready", data: plan })
  } catch (error: unknown) {
    console.error("POST Task Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TASK_ATTACHMENT_MESSAGES.uploadFailed) }, { status: 500 })
  }
}

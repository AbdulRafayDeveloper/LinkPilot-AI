import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TASK_ATTACHMENT_MESSAGES, TASK_IMAGE_MAX_BYTES } from "@/constants/taskAttachments"
import { TaskImageUploadSchema } from "@/lib/validation/taskAttachment"
import { planTaskImageUpload, storeTaskImage } from "@/services/taskImages"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST: stores one image for a task (Daily Tasks, or an employee's plan) and answers what to save on
 * the task, `{ assetId, contentType, url }`, the link being short-lived and only for showing it now.
 *
 * - The body is **the image itself** (PNG, JPEG or WEBP, at most 4 MB): what the pages send. It goes
 *   through the app because the bucket's CORS rule refuses browser uploads from the live site.
 * - A JSON body `{ contentType, size }` still answers `{ assetId, url }`, a link to PUT the image to
 *   directly, for any caller written before; it only works where the bucket allows the site.
 *
 * Not wrapped in withIdempotency: a repeat only stores another copy (or hands out another link), and
 * nothing points at it until a task is saved with it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const type = req.headers.get("content-type") ?? ""
  try {
    if (type.startsWith("application/json")) {
      const parsed = TaskImageUploadSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || TASK_ATTACHMENT_MESSAGES.uploadFailed }, { status: 400 })
      }
      const plan = await planTaskImageUpload(parsed.data.contentType, parsed.data.size)
      return NextResponse.json({ success: true, message: "Upload ready", data: plan })
    }
    if (Number(req.headers.get("content-length") ?? 0) > TASK_IMAGE_MAX_BYTES) {
      return NextResponse.json({ success: false, message: TASK_ATTACHMENT_MESSAGES.imageTooLarge }, { status: 413 })
    }
    const image = await storeTaskImage(Buffer.from(await req.arrayBuffer()))
    return NextResponse.json({ success: true, message: "Image stored", data: image }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Task Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TASK_ATTACHMENT_MESSAGES.uploadFailed) }, { status: 400 })
  }
}

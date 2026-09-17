import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { GenerateImageSchema } from "@/lib/validation/postImages"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { createPostImage } from "@/services/postImages/generate"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
// Drawing an image takes far longer than writing text, and the whole picture comes back at once
export const maxDuration = 300

/**
 * POST: Draws one post image from the saved brand defaults and the post content, stores it, and
 * writes the record that says how it was made. Nothing is written until the image exists.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateImageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || POST_IMAGES_MESSAGES.missingContent },
        { status: 400 }
      )
    }

    const image = withSource(await runAiRequest(auth.viewer, "post-image-creator", () => createPostImage({ ...parsed.data, viewer: auth.viewer, signal: req.signal })))
    return NextResponse.json({ success: true, message: POST_IMAGES_MESSAGES.generated, data: image }, { status: 201 })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Post Image Generate Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, POST_IMAGES_MESSAGES.generationFailed)
    const isUnconfigured = [POST_IMAGES_MESSAGES.modelUnavailable, POST_IMAGES_MESSAGES.storageUnavailable].includes(
      message as never
    )
    const isRefused = message === POST_IMAGES_MESSAGES.refused
    return NextResponse.json({ success: false, message }, { status: isUnconfigured ? 503 : isRefused ? 400 : 500 })
  }
}

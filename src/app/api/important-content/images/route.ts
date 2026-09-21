import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { CONTENT_IMAGE_MAX_BYTES, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { storeContentImage } from "@/services/importantContent/images"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST (the body is the image itself, at most 4 MB): stores one image for a description and answers
 * `{ src }`, the path to write into it. The type is read from the bytes. A repeat stores another copy
 * and nothing points at it until an entry is saved with it, so a retried request is harmless.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > CONTENT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ success: false, message: IMPORTANT_CONTENT_MESSAGES.imageTooLarge }, { status: 413 })
  }
  try {
    const bytes = Buffer.from(await req.arrayBuffer())
    const src = await storeContentImage(auth.viewer, bytes)
    return NextResponse.json({ success: true, message: "Image added", data: { src } }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Important Content Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.imageUploadFailed) }, { status: 400 })
  }
}

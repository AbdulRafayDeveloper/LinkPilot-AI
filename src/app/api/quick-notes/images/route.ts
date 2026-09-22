import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { NOTE_IMAGE_MAX_BYTES, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { storeNoteImage } from "@/services/quickNotes/images"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST (the body is the image itself, at most 4 MB): stores one image for a note and answers
 * `{ src }`, the path to write into it. The type is read from the bytes. A repeat stores another copy
 * and nothing points at it until a note is saved with it, so a retried request is harmless.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  if (Number(req.headers.get("content-length") ?? 0) > NOTE_IMAGE_MAX_BYTES) {
    return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.imageTooLarge }, { status: 413 })
  }
  try {
    const src = await storeNoteImage(auth.viewer, Buffer.from(await req.arrayBuffer()))
    return NextResponse.json({ success: true, message: "Image added", data: { src } }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Quick Note Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.imageUploadFailed) }, { status: 400 })
  }
}

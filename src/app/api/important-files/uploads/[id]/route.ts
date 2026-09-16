import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import { cancelUpload, finishUpload } from "@/services/importantFiles/assets"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST: Finishes an upload once the browser has sent every part. S3 assembles the object from
 * the parts it holds, the server checks what was actually stored, and only then does the file
 * appear in the module. Calling it twice is harmless.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const asset = await finishUpload((await params).id)
    return NextResponse.json({ success: true, message: IMPORTANT_FILES_MESSAGES.created, data: asset })
  } catch (error: unknown) {
    console.error("POST Important File Finish Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.uploadFailed)
    const isMissing = message === IMPORTANT_FILES_MESSAGES.notFound
    return NextResponse.json({ success: false, message }, { status: isMissing ? 404 : 500 })
  }
}

/**
 * DELETE: Gives up on an upload that was cancelled or failed. The multipart upload is aborted,
 * anything already sent is removed and the record goes, so nothing half-uploaded is left.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const cancelled = await cancelUpload((await params).id)
    return NextResponse.json({ success: true, message: "Upload cancelled", data: { cancelled } })
  } catch (error: unknown) {
    console.error("DELETE Important File Upload Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { UploadRequestSchema } from "@/lib/validation/importantFile"
import { IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import { planUpload } from "@/services/importantFiles/assets"

export const dynamic = "force-dynamic"

/**
 * POST: Registers a file and returns the signed links the browser uploads it with, in one PUT
 * for a small file or in parts for a large one. Only this small JSON passes through the app.
 * The file's bytes go straight from the browser to S3, so nothing here is near a request limit.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = UploadRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || IMPORTANT_FILES_MESSAGES.missingFile },
        { status: 400 }
      )
    }

    const plan = await planUpload(parsed.data)
    return NextResponse.json({ success: true, message: "Upload ready", data: plan }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Important File Upload Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.uploadFailed)
    // A file the module refuses is the user's to fix; anything else is the server's problem
    const isRefused = [
      IMPORTANT_FILES_MESSAGES.unsupportedType,
      IMPORTANT_FILES_MESSAGES.tooLarge,
      IMPORTANT_FILES_MESSAGES.missingFile,
    ].includes(message as never)
    const isUnconfigured = message === IMPORTANT_FILES_MESSAGES.storageUnavailable
    return NextResponse.json({ success: false, message }, { status: isRefused ? 400 : isUnconfigured ? 503 : 500 })
  }
}

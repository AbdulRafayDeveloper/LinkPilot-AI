import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import { assetText } from "@/services/importantFiles/assets"

export const dynamic = "force-dynamic"

// Copying puts the text on the clipboard, so a file bigger than this is downloaded instead
const COPYABLE_MAX_BYTES = 1024 * 1024

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET: The contents of a stored text file, so Copy can put the real text on the clipboard.
 * Only text files answer here, and only small ones, because this is the one place a file's
 * contents pass through the app rather than going straight from S3 to the browser.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const text = await assetText((await params).id, COPYABLE_MAX_BYTES)
    if (text === null) {
      return NextResponse.json({ success: false, message: IMPORTANT_FILES_MESSAGES.copyFailed }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Text ready", data: { text } })
  } catch (error: unknown) {
    console.error("GET Important File Text Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.copyFailed) },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { listPostImages } from "@/services/postImages/history"

export const dynamic = "force-dynamic"

/**
 * GET (?cursor=): One batch of made images, newest first. The service caps the batch, and each
 * image carries the settings it was made with plus a short-lived link, never a storage key.
 */
export async function GET(req: NextRequest) {
  try {
    const page = await listPostImages(req.nextUrl.searchParams.get("cursor"))
    return NextResponse.json({ success: true, message: "Post images retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Post Images Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

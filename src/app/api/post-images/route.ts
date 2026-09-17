import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PostImagesQuerySchema } from "@/lib/validation/postImages"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { listPostImages } from "@/services/postImages/history"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?cursor=&search=&size=&photo=&from=&to=): One batch of made images, newest first, 50 at a
 * time, filtered and counted in the database. Each image carries the settings it was made with
 * plus a short-lived link, never a storage key.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = PostImagesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || POST_IMAGES_MESSAGES.loadFailed },
      { status: 400 }
    )
  }

  try {
    const page = await listPostImages(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Post images retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Post Images Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PostImagesQuerySchema } from "@/lib/validation/postImages"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { deletePostImages, listPostImages } from "@/services/postImages/history"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
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

/**
 * DELETE (the same filters as GET, body `{ ids }` or `{ all: true }`): removes several images at
 * once, the ticked ones or every image the filters cover. Each picture goes from storage before its
 * record, so a storage failure leaves the image listed rather than leaving a picture nothing points
 * at; the answer says how many went and how many could not be removed. Final.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const filters = PostImagesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || POST_IMAGES_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const { deleted, failed } = await deletePostImages(auth.viewer, filters.data, body.data.ids)
    const message =
      failed > 0
        ? `${deleted} ${deleted === 1 ? "image" : "images"} deleted. ${failed} could not be removed from storage and ${failed === 1 ? "is" : "are"} still listed.`
        : `${deleted} ${deleted === 1 ? "image" : "images"} deleted.`
    return NextResponse.json({ success: true, message, data: { deleted, failed } })
  } catch (error: unknown) {
    console.error("DELETE Post Images (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { deletePostImage, findPostImage } from "@/services/postImages/history"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET: One image with everything that was used to make it, for the detail view.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const image = await findPostImage((await params).id)
    if (!image) {
      return NextResponse.json({ success: false, message: POST_IMAGES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Post image retrieved", data: image })
  } catch (error: unknown) {
    console.error("GET Post Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes one made image and its record. The brand photo it was made from stays, because
 * it belongs to the defaults and other images may still name it.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const removed = await deletePostImage((await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: POST_IMAGES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: POST_IMAGES_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Post Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

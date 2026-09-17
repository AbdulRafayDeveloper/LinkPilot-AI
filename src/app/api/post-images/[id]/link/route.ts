import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { postImageLink } from "@/services/postImages/history"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET (?download=1): A fresh signed link for one made image, for showing it or for saving it.
 * The link lasts minutes and the bucket stays private.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const link = await postImageLink(auth.viewer, (await params).id, req.nextUrl.searchParams.get("download") === "1")
    if (!link) {
      return NextResponse.json({ success: false, message: POST_IMAGES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Link ready", data: link })
  } catch (error: unknown) {
    console.error("GET Post Image Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

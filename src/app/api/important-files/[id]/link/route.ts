import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import { assetLink } from "@/services/importantFiles/assets"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET (?download=1): A fresh signed link for one file, for viewing or for saving under the name
 * the user gave it. The link lasts minutes and the bucket stays private, so nothing here turns
 * a stored file into a public URL.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const link = await assetLink((await params).id, req.nextUrl.searchParams.get("download") === "1")
    if (!link) {
      return NextResponse.json({ success: false, message: IMPORTANT_FILES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Link ready", data: link })
  } catch (error: unknown) {
    console.error("GET Important File Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.linkFailed) },
      { status: 500 }
    )
  }
}

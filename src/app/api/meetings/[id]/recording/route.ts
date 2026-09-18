import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { recordingLinks } from "@/services/meetings/recording"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Signed links to play and download what was recorded: the screen video once it is joined, the
 * camera if there was one, and each audio piece. The links expire, so they are never cached.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const links = await recordingLinks(auth.viewer, (await params).id)
    if (!links) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Links", data: links }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Recording Links Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_MESSAGES.loadFailed) }, { status: 500 })
  }
}

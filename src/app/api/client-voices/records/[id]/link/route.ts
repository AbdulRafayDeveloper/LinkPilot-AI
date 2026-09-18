import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { voiceLink } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: a short-lived link to play or download one kept recording. The bucket stays private, so a
 * link is made fresh on every read and expires on its own.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const url = await voiceLink(auth.viewer, (await params).id)
    if (!url) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.savedVoicesFailed }, { status: 404 })
    return NextResponse.json({ success: true, message: "Link ready", data: { url } }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Client Voice Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.savedVoicesFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { deleteVoice } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** DELETE: removes one kept voice, recording and record. Another account's voice reads as not found. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const deleted = await deleteVoice(auth.viewer, (await params).id)
    if (!deleted) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.deleteFailed }, { status: 404 })
    return NextResponse.json({ success: true, message: CLIENT_VOICES_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Client Voice Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

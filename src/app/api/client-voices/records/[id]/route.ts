import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EditTranscriptSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { deleteVoice, editVoiceText } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT { transcript?, clearPoints? }: the user's own wording of what this voice said, word for word
 * or in clear points. Each is written only when it is named, and the recording is never touched,
 * since what was said and what the app wrote down are two different things.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EditTranscriptSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.editFailed }, { status: 400 })
  }
  try {
    const saved = await editVoiceText(auth.viewer, (await params).id, parsed.data)
    if (!saved) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.editFailed }, { status: 404 })
    return NextResponse.json({ success: true, message: CLIENT_VOICES_MESSAGES.transcriptSaved, data: saved })
  } catch (error: unknown) {
    console.error("PUT Client Voice Transcript Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.editFailed) }, { status: 500 })
  }
}

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

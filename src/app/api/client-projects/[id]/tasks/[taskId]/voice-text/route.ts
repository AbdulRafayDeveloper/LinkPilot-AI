import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { writeOwnVoiceText } from "@/services/clientProjects/voiceText"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
// Writing a quarter of an hour of speech out, then reading it back in English
export const maxDuration = 120

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

/**
 * POST: writes one overview item's voice note out and reads it back in clear English, keeping both
 * on the item, and answers the item. A repeat writes it again, so the browser may send it again
 * (`{ retry: true }`). Another account's item, or one with no voice, never reaches a model.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id, taskId } = await params
  try {
    const written = await writeOwnVoiceText(auth.viewer, id, taskId, req.signal)
    if (!written) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.taskNotFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Written in English", data: written.task })
  } catch (error: unknown) {
    if (req.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Project Voice Text Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.voiceTextFailed) }, { status: 500 })
  }
}

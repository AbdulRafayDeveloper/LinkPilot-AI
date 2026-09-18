import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EditTasksSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { editTaskGroup } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT { tasks }: the user's own wording of a saved task list. The voices it was made from stay as
 * they are, and another account's list reads as not found.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EditTasksSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.taskEditFailed }, { status: 400 })
  }
  try {
    const saved = await editTaskGroup(auth.viewer, (await params).id, parsed.data.tasks)
    if (!saved) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.taskEditFailed }, { status: 404 })
    return NextResponse.json({ success: true, message: "Tasks saved", data: saved })
  } catch (error: unknown) {
    console.error("PUT Client Voice Tasks Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.taskEditFailed) }, { status: 500 })
  }
}

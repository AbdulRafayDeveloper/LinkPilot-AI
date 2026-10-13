import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { MEETING_NOTES_MAX_LENGTH, MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import { saveMeetingNotes } from "@/services/meetingPlanner/plans"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * The meeting's own notes, written before it or after it. They are the user's own text and nothing
 * here ever reads them to a model, so they are one of the plain text boxes (constants/textLimits.ts)
 * rather than carrying a model-facing limit.
 */
const NotesSchema = z.object({
  notes: z
    .string({ error: MEETING_PLANNER_MESSAGES.notesFailed })
    .max(MEETING_NOTES_MAX_LENGTH, MEETING_PLANNER_MESSAGES.notesTooLong),
})

/**
 * PUT: replaces the notes. Saving an empty box clears them, which is how notes are taken off a
 * meeting again. Nothing else on the meeting is touched, so notes can be written while a
 * preparation is being generated.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = NotesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || MEETING_PLANNER_MESSAGES.notesFailed },
        { status: 400 }
      )
    }

    const meeting = await saveMeetingNotes(auth.viewer, (await params).id, parsed.data.notes)
    if (!meeting) {
      return NextResponse.json({ success: false, message: MEETING_PLANNER_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: MEETING_PLANNER_MESSAGES.notesSaved, data: meeting })
  } catch (error: unknown) {
    console.error("PUT Meeting Notes Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, MEETING_PLANNER_MESSAGES.notesFailed) },
      { status: 500 }
    )
  }
}

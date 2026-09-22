import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { QuickNoteSchema } from "@/lib/validation/quickNotes"
import { deleteNote, updateNote } from "@/services/quickNotes/notes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT `{ content, title? }`: replaces one note's title and content. This is what an edit's auto-save
 * sends, so the same request repeated lands on the same text and is safe to retry. Another account's
 * note, or one already gone, is a 404.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = QuickNoteSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || QUICK_NOTES_MESSAGES.missingContent },
        { status: 400 }
      )
    }
    const note = await updateNote(auth.viewer, (await params).id, parsed.data)
    if (!note) return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: QUICK_NOTES_MESSAGES.saved, data: note })
  } catch (error: unknown) {
    console.error("PUT Quick Note Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes one note, and the images only it named. A note that is already gone answers 404,
 * which the list treats as "it is gone either way" rather than an error worth showing.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteNote(auth.viewer, (await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Note deleted.", data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Quick Note Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}

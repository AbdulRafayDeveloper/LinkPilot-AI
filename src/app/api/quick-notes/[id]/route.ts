import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { deleteNote } from "@/services/quickNotes/notes"

export const dynamic = "force-dynamic"

/**
 * DELETE: Removes one note. A note that is already gone answers 404, which the list treats as
 * "it is gone either way" rather than an error worth showing.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const removed = await deleteNote((await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: "That note no longer exists." }, { status: 404 })
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

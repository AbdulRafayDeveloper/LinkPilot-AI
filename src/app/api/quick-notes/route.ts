import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { NOTE_MAX_LENGTH, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { clearNotes, deleteNotes, listNotes, saveNote } from "@/services/quickNotes/notes"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"


const NoteSchema = z.object({
  content: z
    .string({ error: QUICK_NOTES_MESSAGES.missingContent })
    .trim()
    .min(1, QUICK_NOTES_MESSAGES.missingContent)
    .max(NOTE_MAX_LENGTH, QUICK_NOTES_MESSAGES.contentTooLong),
})

/**
 * GET (?cursor=): One batch of saved notes, newest first. Without a cursor the batch starts at
 * the newest note; with one it continues after that note, which is what the list does as it scrolls.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const notes = await listNotes(auth.viewer, req.nextUrl.searchParams.get("cursor"))
    return NextResponse.json({ success: true, message: "Saved notes retrieved", data: notes })
  } catch (error: unknown) {
    console.error("GET Quick Notes Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * POST: Saves one note. Saving the same text again keeps both, newest first.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = NoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || QUICK_NOTES_MESSAGES.missingContent },
        { status: 400 }
      )
    }

    const note = await saveNote(auth.viewer, parsed.data.content)
    return NextResponse.json({ success: true, message: QUICK_NOTES_MESSAGES.saved, data: note }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Quick Note Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Deletes every note this account owns. The page asks for confirmation before calling this.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    // With ids, only those notes go; without a body at all, every note of this account does
    const body = await req.json().catch(() => null)
    const ticked = body === null ? null : BulkDeleteSchema.safeParse(body)
    if (ticked?.success && ticked.data.ids) {
      const removed = await deleteNotes(auth.viewer, ticked.data.ids)
      return NextResponse.json({
        success: true,
        message: `${removed} ${removed === 1 ? "note" : "notes"} deleted.`,
        data: { deleted: removed },
      })
    }

    const deleted = await clearNotes(auth.viewer)
    return NextResponse.json({ success: true, message: QUICK_NOTES_MESSAGES.cleared, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Quick Notes Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.clearFailed) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("quick-notes", handlePost)

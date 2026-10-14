import { NextRequest, NextResponse } from "next/server"
import { statusFor, toUserFacingMessage, UserFacingError } from "@/lib/errors"
import { ImportantContentSchema } from "@/lib/validation/importantContent"
import { IMPORTANT_CONTENT_TOOL } from "@/constants/importantContent"
import { QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { moveNoteToContent } from "@/services/quickNotes/moveToContent"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST `{ name, type, description, textSize?, folderId? }`: saves this note as an Important Content
 * entry (the same body that module's own create takes, checked by the same schema) and deletes the
 * note. It sits under Quick Notes, so that tool's switch covers it, and it writes into Important
 * Content, so an account with that tool turned off is refused here too (403): hiding the button is
 * never the protection. Creates a record, so a repeat of the same request answers with the first
 * entry rather than a second one.
 */
async function handlePost(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  if (auth.viewer.disabledTools.includes(IMPORTANT_CONTENT_TOOL.id)) {
    return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.moveUnavailable }, { status: 403 })
  }
  const parsed = ImportantContentSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || QUICK_NOTES_MESSAGES.moveFailed }, { status: 400 })
  }
  try {
    const moved = await moveNoteToContent(auth.viewer, (await params).id, parsed.data)
    if (!moved) return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.notFound }, { status: 404 })
    const message = moved.noteDeleted ? QUICK_NOTES_MESSAGES.moved(moved.entry.name) : QUICK_NOTES_MESSAGES.movedButKept(moved.entry.name)
    return NextResponse.json({ success: true, message, data: moved }, { status: 201 })
  } catch (error: unknown) {
    // A folder that is gone is the one refusal the service names
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: statusFor(error, 404) })
    console.error("POST Quick Note move Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.moveFailed) }, { status: statusFor(error, 500) })
  }
}

export const POST = withIdempotency("quick-notes-move", handlePost)

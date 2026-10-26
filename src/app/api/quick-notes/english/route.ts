import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { SpokenNoteSchema } from "@/lib/validation/quickNotes"
import { spokenNoteToEnglish } from "@/services/quickNotes/english"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"

/**
 * POST `{ text }`: what was spoken for a note, written in clear English, answered as
 * `{ english, sourceLanguage, provider, providers }`.
 *
 * It **stores nothing**: the page adds the English to the editor and the note is saved the usual
 * way. So a repeat costs another model call and nothing else, and the browser may send it again
 * (`{ retry: true }`). It sits under /api/quick-notes, so Quick Notes' own switch covers it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = SpokenNoteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || QUICK_NOTES_MESSAGES.speechMissing }, { status: 400 })
  }

  try {
    const english = withSource(await runAiRequest(auth.viewer, "quick-notes", () => spokenNoteToEnglish(parsed.data.text, req.signal)))
    // What was said is never written to the log, only how long it was and what it was read from
    console.log("Quick note read in English", { chars: parsed.data.text.length, language: english.sourceLanguage, provider: english.provider })
    return NextResponse.json({ success: true, message: "Written in English", data: english })
  } catch (error: unknown) {
    if (req.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Quick Notes English Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, QUICK_NOTES_MESSAGES.speechEnglishFailed) }, { status: 500 })
  }
}

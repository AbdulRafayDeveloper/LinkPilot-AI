import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { VoiceUploadQuerySchema } from "@/lib/validation/clientProjectTasks"
import { PROJECT_TASK_MESSAGES, VOICE_NOTE_MAX_BYTES } from "@/constants/clientProjectTasks"
import { storeVoiceNote } from "@/services/clientProjects/voiceNotes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST (?seconds=, body: the recording itself): stores one voice note and answers what to save on
 * the task, with a link to play it from straight away. Through the app rather than straight to
 * storage, because the bucket refuses browser uploads from the live site; 4 MB fits the body a
 * serverless function takes. The container is read from the bytes, never from the Content-Type.
 *
 * It saves nothing but the object, so a repeat only ever leaves a copy nothing points at: the
 * browser may safely send it again.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { seconds } = VoiceUploadQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
  const bytes = Buffer.from(await req.arrayBuffer())
  if (bytes.length === 0) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.voiceUnsupported }, { status: 400 })
  if (bytes.length > VOICE_NOTE_MAX_BYTES) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.voiceTooLarge }, { status: 400 })

  try {
    const note = await storeVoiceNote(bytes, seconds)
    return NextResponse.json({ success: true, message: "Voice note saved", data: note }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    console.error("POST Project Voice Note Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.voiceFailed) }, { status: 500 })
  }
}

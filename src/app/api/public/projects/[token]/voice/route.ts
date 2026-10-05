import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES, VOICE_NOTE_MAX_BYTES } from "@/constants/clientProjectTasks"
import { VoiceUploadQuerySchema } from "@/lib/validation/clientProjectTasks"
import { storeVoiceNote } from "@/services/clientProjects/voiceNotes"
import { publicProjectExists } from "@/services/clientProjects/publicTasks"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

/**
 * POST (?seconds=, body: the recording itself): stores one voice note for an item the client is
 * writing from a shared project link, and answers what to save on it, exactly as
 * `/api/client-projects/voice` does for a signed-in page.
 *
 * **Nobody is signed in here, so the project's signed token is what is checked**, and it is checked
 * **before** anything is stored: a token that opens nothing stores nothing, and the owner turning
 * the link off closes this door too. The rest is the same as every recording this app keeps: at
 * most 4 MB, the container read from the bytes rather than from the Content-Type, and the key built
 * on the server from an id it makes.
 *
 * It saves no record, so a repeat only ever leaves a copy nothing points at.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { seconds } = VoiceUploadQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
  try {
    if (!(await publicProjectExists(token))) {
      return NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })
    }
    const bytes = Buffer.from(await req.arrayBuffer())
    if (bytes.length === 0) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.voiceUnsupported }, { status: 400, headers: noStore })
    if (bytes.length > VOICE_NOTE_MAX_BYTES) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.voiceTooLarge }, { status: 400, headers: noStore })

    const note = await storeVoiceNote(bytes, seconds)
    return NextResponse.json({ success: true, message: "Voice note saved", data: note }, { status: 201, headers: noStore })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400, headers: noStore })
    console.error("POST Public Project Voice Note Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.voiceFailed) }, { status: 500, headers: noStore })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { VOICE_MAX_BYTES, VOICE_MESSAGES } from "@/constants/voiceInput"
import { VOICE_MODULE_IDS } from "@/constants/modelPriority"
import { withModelOrder } from "@/lib/modelOrder"
import { modelOrderFor } from "@/services/modelPriority"
import { transcribeRecording } from "@/services/transcribeAudio"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const AudioSchema = z
  .instanceof(Blob, { error: VOICE_MESSAGES.emptyRecording })
  .refine((file) => file.size > 0, VOICE_MESSAGES.emptyRecording)
  .refine((file) => file.size <= VOICE_MAX_BYTES, VOICE_MESSAGES.audioTooLarge)

// The module that recorded it, so the speech is read in that module's provider order
const PageSchema = z.enum(VOICE_MODULE_IDS).optional()

/**
 * POST (multipart form: audio, optional for): turns one recording into text, so anything a page asks
 * for can be spoken instead of typed, and says which provider wrote it out. The recording's format is
 * read from its own bytes. `for` names the module, whose provider order is used (Groq first unless an admin changed it).
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const form = await req.formData().catch(() => null)
    const parsed = AudioSchema.safeParse(form?.get("audio") ?? undefined)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || VOICE_MESSAGES.emptyRecording },
        { status: 400 }
      )
    }

    const page = PageSchema.safeParse(form?.get("for") ?? undefined)
    if (!page.success) {
      return NextResponse.json({ success: false, message: "Unknown page for this recording." }, { status: 400 })
    }

    const data = Buffer.from(await parsed.data.arrayBuffer())
    const mimeType = detectAudioMimeType(data)
    if (!mimeType) {
      return NextResponse.json({ success: false, message: VOICE_MESSAGES.unsupportedAudio }, { status: 400 })
    }

    const order = page.data ? await modelOrderFor(auth.viewer, page.data) : undefined
    const transcribe = () => transcribeRecording({ audio: { data, mimeType }, signal: req.signal })
    const { text, provider } = order ? await withModelOrder(order, transcribe) : await transcribe()
    return NextResponse.json({ success: true, message: "Recording written out", data: { text, provider } })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Transcribe Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, VOICE_MESSAGES.transcriptionFailed)
    // A recording nobody can make out is about the recording; a missing provider is about the server
    const status = message === VOICE_MESSAGES.transcriptionFailed ? 500 : message === VOICE_MESSAGES.voiceUnavailable ? 503 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}

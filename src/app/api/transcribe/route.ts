import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { VOICE_MAX_BYTES, VOICE_MESSAGES } from "@/constants/voiceInput"
import { transcribeRecording } from "@/services/transcribeAudio"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const AudioSchema = z
  .instanceof(Blob, { error: VOICE_MESSAGES.emptyRecording })
  .refine((file) => file.size > 0, VOICE_MESSAGES.emptyRecording)
  .refine((file) => file.size <= VOICE_MAX_BYTES, VOICE_MESSAGES.audioTooLarge)

/**
 * POST (multipart form: audio): turns one recording into text, so anything a page asks for can
 * be spoken instead of typed. The recording's format is read from its own bytes.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null)
    const parsed = AudioSchema.safeParse(form?.get("audio") ?? undefined)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || VOICE_MESSAGES.emptyRecording },
        { status: 400 }
      )
    }

    const data = Buffer.from(await parsed.data.arrayBuffer())
    const mimeType = detectAudioMimeType(data)
    if (!mimeType) {
      return NextResponse.json({ success: false, message: VOICE_MESSAGES.unsupportedAudio }, { status: 400 })
    }

    const text = await transcribeRecording({ audio: { data, mimeType }, signal: req.signal })
    return NextResponse.json({ success: true, message: "Recording written out", data: { text } })
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

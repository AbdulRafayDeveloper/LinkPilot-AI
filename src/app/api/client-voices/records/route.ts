import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { CLIENT_VOICES_MESSAGES, TRANSCRIPT_MAX_LENGTH, VOICE_BATCH_MAX, VOICE_MAX_BYTES } from "@/constants/clientVoices"
import { saveVoice } from "@/services/clientVoices/records"
import { batchClient } from "@/services/clientVoices/batches"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const SaveSchema = z.object({
  // The batch this voice belongs to, started before the run (POST /api/client-voices/batches)
  batchId: z.string().regex(/^[0-9a-f]{24}$/, CLIENT_VOICES_MESSAGES.batchMissing),
  position: z.coerce.number().int().min(1).max(VOICE_BATCH_MAX).default(1),
  name: z.string().trim().max(200).default("voice"),
  transcript: z.string().trim().max(TRANSCRIPT_MAX_LENGTH).default(""),
  transcribedBy: z.string().trim().max(40).optional(),
})

const AudioSchema = z
  .instanceof(Blob, { error: CLIENT_VOICES_MESSAGES.emptyFile })
  .refine((file) => file.size > 0, CLIENT_VOICES_MESSAGES.emptyFile)
  .refine((file) => file.size <= VOICE_MAX_BYTES, CLIENT_VOICES_MESSAGES.tooLarge)

/**
 * POST (multipart: audio, batchId, position, name, transcript, transcribedBy): keeps one voice of a
 * batch, once it has been written out. The recording's own bytes decide its format, like every other
 * audio the app takes, and **the client comes from the batch** rather than from the request, so a
 * voice can never be stamped with a client its batch is not kept under.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const form = await req.formData().catch(() => null)
    const audio = AudioSchema.safeParse(form?.get("audio") ?? undefined)
    if (!audio.success) {
      return NextResponse.json({ success: false, message: audio.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.emptyFile }, { status: 400 })
    }
    const parsed = SaveSchema.safeParse({
      batchId: form?.get("batchId") ?? undefined,
      position: form?.get("position") ?? undefined,
      name: form?.get("name") ?? undefined,
      transcript: form?.get("transcript") ?? undefined,
      transcribedBy: form?.get("transcribedBy") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.batchMissing }, { status: 400 })
    }

    const client = await batchClient(auth.viewer, parsed.data.batchId)
    if (!client) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.batchMissing }, { status: 404 })

    const bytes = Buffer.from(await audio.data.arrayBuffer())
    const contentType = detectAudioMimeType(bytes)
    if (!contentType) {
      return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.unsupported }, { status: 400 })
    }
    const saved = await saveVoice(auth.viewer, {
      ...parsed.data,
      ...client,
      transcribedBy: parsed.data.transcribedBy ?? null,
      contentType,
      audio: bytes,
    })
    return NextResponse.json({ success: true, message: "Voice kept", data: saved }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Client Voices Record Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.saveFailed) }, { status: 500 })
  }
}

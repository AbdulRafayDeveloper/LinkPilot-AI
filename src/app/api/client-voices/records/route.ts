import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { CLIENT_VOICES_MESSAGES, TRANSCRIPT_MAX_LENGTH, VOICE_BATCH_MAX, VOICE_MAX_BYTES } from "@/constants/clientVoices"
import { listVoices, saveVoice } from "@/services/clientVoices/records"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const ListSchema = z.object({
  clientId: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
})

const SaveSchema = z.object({
  clientId: z.string({ error: CLIENT_VOICES_MESSAGES.noClient }).trim().min(1, CLIENT_VOICES_MESSAGES.noClient),
  position: z.coerce.number().int().min(1).max(VOICE_BATCH_MAX).default(1),
  name: z.string().trim().max(200).default("voice"),
  transcript: z.string().trim().max(TRANSCRIPT_MAX_LENGTH).default(""),
  transcribedBy: z.string().trim().max(40).optional(),
})

const AudioSchema = z
  .instanceof(Blob, { error: CLIENT_VOICES_MESSAGES.emptyFile })
  .refine((file) => file.size > 0, CLIENT_VOICES_MESSAGES.emptyFile)
  .refine((file) => file.size <= VOICE_MAX_BYTES, CLIENT_VOICES_MESSAGES.tooLarge)

/** GET (?clientId=&page=): the voices kept for one client, or for every client, newest first. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.savedVoicesFailed }, { status: 400 })
  }
  try {
    const page = await listVoices(auth.viewer, parsed.data.clientId || null, parsed.data.page)
    return NextResponse.json({ success: true, message: "Saved voices retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Client Voices Records Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.savedVoicesFailed) }, { status: 500 })
  }
}

/**
 * POST (multipart: audio, clientId, position, name, transcript, transcribedBy): keeps one voice with
 * its client, once it has been written out. The recording's own bytes decide its format, like every
 * other audio the app takes.
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
      clientId: form?.get("clientId") ?? undefined,
      position: form?.get("position") ?? undefined,
      name: form?.get("name") ?? undefined,
      transcript: form?.get("transcript") ?? undefined,
      transcribedBy: form?.get("transcribedBy") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.noClient }, { status: 400 })
    }

    const bytes = Buffer.from(await audio.data.arrayBuffer())
    const contentType = detectAudioMimeType(bytes)
    if (!contentType) {
      return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.unsupported }, { status: 400 })
    }
    const saved = await saveVoice(auth.viewer, { ...parsed.data, transcribedBy: parsed.data.transcribedBy ?? null, contentType, audio: bytes })
    return NextResponse.json({ success: true, message: "Voice kept", data: saved }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Client Voices Record Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.saveFailed) }, { status: 500 })
  }
}

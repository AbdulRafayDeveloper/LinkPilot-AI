import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  COMPANY_NAME_MAX_LENGTH,
  CONNECTION_NOTE_MESSAGES,
  CONNECTION_NOTE_TONE_IDS,
  PROFILE_DATA_MAX_LENGTH,
} from "@/constants/connectionNote"
import { generateConnectionNote } from "@/services/connectionNote/generate"
import { recordConnectionNote } from "@/services/generationRecords"
import { requireViewer } from "@/services/auth/viewer"
import { withModelOrder } from "@/lib/modelOrder"
import { modelOrderFor } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  profileData: z
    .string({ error: CONNECTION_NOTE_MESSAGES.missingProfile })
    .trim()
    .min(1, CONNECTION_NOTE_MESSAGES.missingProfile)
    .max(PROFILE_DATA_MAX_LENGTH, CONNECTION_NOTE_MESSAGES.profileTooLong),
  tone: z.enum(CONNECTION_NOTE_TONE_IDS, { error: CONNECTION_NOTE_MESSAGES.missingTone }),
  // Only the company tones (COMPANY_TONES) use it; blank means "take the company from the profile"
  companyName: z
    .string()
    .trim()
    .max(COMPANY_NAME_MAX_LENGTH, CONNECTION_NOTE_MESSAGES.companyTooLong)
    .transform((name) => name.replace(/\s+/g, " ") || undefined)
    .optional(),
})

/**
 * POST: Generates one connection note from raw profile text using the latest saved
 * prompt for the selected tone (the module's provider order, Groq first).
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || CONNECTION_NOTE_MESSAGES.missingProfile },
        { status: 400 }
      )
    }

    const result = await withModelOrder(await modelOrderFor(auth.viewer, "connection-note"), () => generateConnectionNote({ ...parsed.data, signal: req.signal }))
    await recordConnectionNote(auth.viewer, parsed.data, result)
    return NextResponse.json({ success: true, message: "Connection note generated", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST Connection Note Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, CONNECTION_NOTE_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}

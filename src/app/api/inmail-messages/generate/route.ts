import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { INMAIL_MESSAGES, INMAIL_PROFILE_MAX_LENGTH, INMAIL_TUNE_IDS } from "@/constants/inmail"
import { generateInMail } from "@/services/inmail/generate"
import { recordInMail } from "@/services/generationRecords"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  profileData: z
    .string({ error: INMAIL_MESSAGES.missingProfile })
    .trim()
    .min(1, INMAIL_MESSAGES.missingProfile)
    .max(INMAIL_PROFILE_MAX_LENGTH, INMAIL_MESSAGES.profileTooLong),
  tune: z.enum(INMAIL_TUNE_IDS, { error: INMAIL_MESSAGES.missingTune }),
})

/**
 * POST: Generates one InMail (separate subject and message) from raw profile text using
 * the latest saved prompt for the selected tune (Gemini first, OpenAI fallback).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || INMAIL_MESSAGES.missingProfile },
        { status: 400 }
      )
    }

    const result = await generateInMail({ ...parsed.data, signal: req.signal })
    await recordInMail(parsed.data, result)
    return NextResponse.json({ success: true, message: "InMail generated", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST InMail Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, INMAIL_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}

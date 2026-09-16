import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import {
  FIRST_MESSAGE_MESSAGES,
  FIRST_MESSAGE_PROFILE_MAX_LENGTH,
  FIRST_MESSAGE_TUNE_IDS,
} from "@/constants/firstMessage"
import { generateFirstMessage } from "@/services/firstMessage/generate"
import { recordFirstMessage } from "@/services/generationRecords"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  profileData: z
    .string({ error: FIRST_MESSAGE_MESSAGES.missingProfile })
    .trim()
    .min(1, FIRST_MESSAGE_MESSAGES.missingProfile)
    .max(FIRST_MESSAGE_PROFILE_MAX_LENGTH, FIRST_MESSAGE_MESSAGES.profileTooLong),
  tune: z.enum(FIRST_MESSAGE_TUNE_IDS, { error: FIRST_MESSAGE_MESSAGES.missingTune }),
})

/**
 * POST: Generates one first message from raw profile text using the latest saved prompt
 * for the selected tune (Gemini first, OpenAI fallback).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || FIRST_MESSAGE_MESSAGES.missingProfile },
        { status: 400 }
      )
    }

    const result = await generateFirstMessage({ ...parsed.data, signal: req.signal })
    await recordFirstMessage(parsed.data, result)
    return NextResponse.json({ success: true, message: "First message generated", data: result })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    console.error("POST First Message Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, FIRST_MESSAGE_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}

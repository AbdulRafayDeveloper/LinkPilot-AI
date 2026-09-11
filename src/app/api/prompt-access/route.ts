import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PROMPT_ACCESS_MESSAGES, PROMPT_PASSWORD_MAX_LENGTH } from "@/constants/promptAccess"
import { getPromptAccessStatus, submitPromptPassword, type PasswordOutcome } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const PasswordSchema = z.object({
  password: z
    .string({ error: PROMPT_ACCESS_MESSAGES.missingPassword })
    .min(1, PROMPT_ACCESS_MESSAGES.missingPassword)
    .max(PROMPT_PASSWORD_MAX_LENGTH, PROMPT_ACCESS_MESSAGES.missingPassword),
})

const HTTP_STATUS: Record<PasswordOutcome, number> = { granted: 200, rejected: 401, locked: 429, disabled: 503 }

/**
 * GET: Whether this browser may open the Update Prompt editors right now.
 */
export async function GET() {
  const status = await getPromptAccessStatus()
  return NextResponse.json({ success: true, message: "Prompt access status retrieved", data: status })
}

/**
 * POST: Checks the prompt password. A correct one unlocks every tool's prompt editor in
 * this browser for 48 hours; the third wrong one locks this browser out for 24 hours.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = PasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || PROMPT_ACCESS_MESSAGES.missingPassword },
      { status: 400 }
    )
  }

  const { outcome, status } = await submitPromptPassword(parsed.data.password, req.nextUrl.protocol === "https:")
  const messages: Record<PasswordOutcome, string> = {
    granted: PROMPT_ACCESS_MESSAGES.granted,
    rejected: `Incorrect password. ${status.attemptsLeft} ${status.attemptsLeft === 1 ? "attempt" : "attempts"} left before prompt editing is locked.`,
    locked: PROMPT_ACCESS_MESSAGES.locked,
    disabled: PROMPT_ACCESS_MESSAGES.disabled,
  }
  return NextResponse.json(
    { success: outcome === "granted", message: messages[outcome], data: status },
    { status: HTTP_STATUS[outcome] }
  )
}

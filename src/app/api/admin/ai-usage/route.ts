import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { AI_USAGE_DAYS, MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import { summarizeAiUsage } from "@/services/aiUsage"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const QuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((value) => (AI_USAGE_DAYS as readonly number[]).includes(value), MODEL_PRIORITY_MESSAGES.badUsageRange)
    .default(AI_USAGE_DAYS[0]),
})

/**
 * GET (?days=1|7|30): Admin only. Budget tracking: what each AI provider used over the window (calls,
 * input, output and total tokens, seconds of speech, images) and what each module used of each provider,
 * read from ai_usage. Counts only, never a prompt or an answer.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || MODEL_PRIORITY_MESSAGES.badUsageRange }, { status: 400 })
  }
  try {
    return NextResponse.json({ success: true, message: "AI usage retrieved", data: await summarizeAiUsage(parsed.data.days) })
  } catch (error: unknown) {
    console.error("GET AI Usage Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MODEL_PRIORITY_MESSAGES.usageFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { CostQuerySchema } from "@/lib/validation/aiCosts"
import { AI_COST_MESSAGES } from "@/constants/aiCosts"
import { costReport } from "@/services/aiCosts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?from=&to=&provider=&model=&module=&kind=&tz=): Admin only. What the AI calls the filters
 * cover cost, split by model, provider, module, kind and day, with the filter choices read from
 * every call ever recorded. Counts and money only, never a prompt or an answer.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = CostQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || AI_COST_MESSAGES.loadFailed }, { status: 400 })
  }
  try {
    return NextResponse.json({ success: true, message: "AI costs retrieved", data: await costReport(parsed.data) })
  } catch (error: unknown) {
    console.error("GET AI Costs Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AI_COST_MESSAGES.loadFailed) }, { status: 500 })
  }
}

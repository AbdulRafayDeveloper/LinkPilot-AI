import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { ADMIN_PROMPT_MESSAGES, ADMIN_PROMPT_TOOLS } from "@/constants/adminPrompts"
import { listSystemPrompts } from "@/services/admin/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const QuerySchema = z.object({ tool: z.enum(ADMIN_PROMPT_TOOLS as [string, ...string[]], { error: ADMIN_PROMPT_MESSAGES.unknownTool }) })

/** GET ?tool=: Admin only. Every system prompt stored under one module, as saved now. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = QuerySchema.safeParse({ tool: req.nextUrl.searchParams.get("tool") })
  if (!parsed.success) return NextResponse.json({ success: false, message: ADMIN_PROMPT_MESSAGES.unknownTool }, { status: 400 })
  try {
    const prompts = await listSystemPrompts(parsed.data.tool)
    return NextResponse.json({ success: true, message: "Prompts loaded", data: prompts }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Admin Prompts Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_PROMPT_MESSAGES.loadFailed) }, { status: 500 })
  }
}

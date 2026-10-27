import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { ADMIN_PROMPT_MESSAGES, PROMPT_TOOL_PATTERN } from "@/constants/adminPrompts"
import { listModulePrompts, listPromptModules } from "@/services/admin/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const QuerySchema = z.object({ tool: z.string().regex(PROMPT_TOOL_PATTERN, ADMIN_PROMPT_MESSAGES.unknownTool).optional() })

/**
 * Admin only. GET: every module that has prompts stored, with its counts. GET ?tool=: every prompt
 * stored under that module, its system prompts first, as saved now.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = QuerySchema.safeParse({ tool: req.nextUrl.searchParams.get("tool") ?? undefined })
  if (!parsed.success) return NextResponse.json({ success: false, message: ADMIN_PROMPT_MESSAGES.unknownTool }, { status: 400 })
  try {
    const { tool } = parsed.data
    const data = tool ? await listModulePrompts(tool) : await listPromptModules()
    return NextResponse.json({ success: true, message: "Prompts loaded", data }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Admin Prompts Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ADMIN_PROMPT_MESSAGES.loadFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { savedOutputsQuerySchema } from "@/lib/validation/savedOutputs"
import { SAVED_OUTPUT_MESSAGES, getSavedOutputTool } from "@/constants/savedOutputs"
import { listSavedOutputs } from "@/services/savedOutputs"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?page=&search=&option=&context=&from=&to=): One page of what a tool wrote, newest first,
 * 50 to a page, filtered and counted in the database. A user gets their own records, an admin
 * everyone's. The text each record was written from is left out; GET [tool]/[id] reads it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const tool = getSavedOutputTool((await params).tool)
  if (!tool) {
    return NextResponse.json({ success: false, message: SAVED_OUTPUT_MESSAGES.unknownTool }, { status: 404 })
  }

  const parsed = savedOutputsQuerySchema(tool).safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || SAVED_OUTPUT_MESSAGES.loadFailed },
      { status: 400 }
    )
  }

  try {
    const page = await listSavedOutputs(auth.viewer, tool, parsed.data)
    return NextResponse.json({ success: true, message: "Saved outputs retrieved", data: page })
  } catch (error: unknown) {
    console.error(`GET Saved Outputs (${tool.id}) Exception:`, error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, SAVED_OUTPUT_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

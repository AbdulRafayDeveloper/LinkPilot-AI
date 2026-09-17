import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { SAVED_OUTPUT_MESSAGES, getSavedOutputTool } from "@/constants/savedOutputs"
import { deleteSavedOutput, getSavedOutput } from "@/services/savedOutputs"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ tool: string; id: string }> }

const notFound = (message: string) => NextResponse.json({ success: false, message }, { status: 404 })

/**
 * GET: One record a tool wrote, with the whole text it was written from (the pasted profile, the
 * conversation, the post). Another account's record reads as not found.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { tool: toolId, id } = await params
  const tool = getSavedOutputTool(toolId)
  if (!tool) return notFound(SAVED_OUTPUT_MESSAGES.unknownTool)

  try {
    const record = await getSavedOutput(auth.viewer, tool, id)
    return record ? NextResponse.json({ success: true, message: "Saved output retrieved", data: record }) : notFound(SAVED_OUTPUT_MESSAGES.notFound)
  } catch (error: unknown) {
    console.error(`GET Saved Output (${tool.id}) Exception:`, error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, SAVED_OUTPUT_MESSAGES.sourceFailed) }, { status: 500 })
  }
}

/** DELETE: Removes one record. The page deletes on one click, without asking first. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { tool: toolId, id } = await params
  const tool = getSavedOutputTool(toolId)
  if (!tool) return notFound(SAVED_OUTPUT_MESSAGES.unknownTool)

  try {
    const removed = await deleteSavedOutput(auth.viewer, tool, id)
    return removed
      ? NextResponse.json({ success: true, message: SAVED_OUTPUT_MESSAGES.deleted, data: { deleted: 1 } })
      : notFound(SAVED_OUTPUT_MESSAGES.notFound)
  } catch (error: unknown) {
    console.error(`DELETE Saved Output (${tool.id}) Exception:`, error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, SAVED_OUTPUT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

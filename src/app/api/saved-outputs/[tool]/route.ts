import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { savedOutputsDeleteSchema, savedOutputsQuerySchema } from "@/lib/validation/savedOutputs"
import { SAVED_OUTPUT_MESSAGES, getSavedOutputTool } from "@/constants/savedOutputs"
import { deleteSavedOutputs, listSavedOutputs } from "@/services/savedOutputs"
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

/**
 * DELETE (?the same filters as GET, body `{ ids }` or `{ all: true }`): removes several records at
 * once. `ids` deletes the records ticked on the page; `all` deletes every record the filters on the
 * page cover, across every page of them. Both stay inside what the viewer may see, so a user can
 * only delete their own records. Deleting is final: nothing here can be undone.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const tool = getSavedOutputTool((await params).tool)
  if (!tool) {
    return NextResponse.json({ success: false, message: SAVED_OUTPUT_MESSAGES.unknownTool }, { status: 404 })
  }

  const filters = savedOutputsQuerySchema(tool).safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = savedOutputsDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || SAVED_OUTPUT_MESSAGES.deleteFailed }, { status: 400 })
  }

  try {
    const { deleted } = await deleteSavedOutputs(auth.viewer, tool, filters.data, body.data.ids)
    const noun = deleted === 1 ? tool.noun.one : tool.noun.many
    return NextResponse.json({ success: true, message: `${deleted} ${noun} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error(`DELETE Saved Outputs (${tool.id}) Exception:`, error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, SAVED_OUTPUT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

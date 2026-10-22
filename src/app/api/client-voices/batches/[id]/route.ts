import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EditTasksSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { batchDetail, deleteBatches, editBatchLists } from "@/services/clientVoices/batches"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** One batch: everything that came out of it, the user's own wording of its lists, and deleting it. */

const NO_FILTERS = { search: "", client: "", from: null, to: null }

/**
 * GET: the batch with its voices, each carrying a freshly signed link to play and to download, so
 * the page needs nothing else to play a recording. Another account's batch reads as not found.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const batch = await batchDetail(auth.viewer, (await params).id)
    if (!batch) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.batchMissing }, { status: 404 })
    // The links expire, so nothing about this answer may be held by a cache
    return NextResponse.json({ success: true, message: "Batch retrieved", data: batch }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Client Voice Batch Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.historyFailed) }, { status: 500 })
  }
}

/** PUT { tasks, questions? }: the user's own wording. The voices it was made from stay as they are. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = EditTasksSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.taskEditFailed }, { status: 400 })
  }
  try {
    const saved = await editBatchLists(auth.viewer, (await params).id, parsed.data)
    if (!saved) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.batchMissing }, { status: 404 })
    return NextResponse.json({ success: true, message: "Saved", data: saved })
  } catch (error: unknown) {
    console.error("PUT Client Voice Batch Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.taskEditFailed) }, { status: 500 })
  }
}

/** DELETE: the batch with its recordings and transcripts. A recording that cannot be removed keeps it. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const result = await deleteBatches(auth.viewer, NO_FILTERS, [(await params).id])
    if (result.deleted === 0) {
      const message = result.failed > 0 ? CLIENT_VOICES_MESSAGES.deleteBatchFailed : CLIENT_VOICES_MESSAGES.batchMissing
      return NextResponse.json({ success: false, message }, { status: result.failed > 0 ? 500 : 404 })
    }
    return NextResponse.json({ success: true, message: CLIENT_VOICES_MESSAGES.batchDeleted, data: result })
  } catch (error: unknown) {
    console.error("DELETE Client Voice Batch Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.deleteBatchFailed) }, { status: 500 })
  }
}

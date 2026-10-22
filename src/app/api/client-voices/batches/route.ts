import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { BatchesQuerySchema, StartBatchSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { deleteBatches, listBatches, startBatch } from "@/services/clientVoices/batches"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * Every batch of client voice messages: the list behind the "view all" page, starting a new one,
 * and deleting several at once.
 */

/** GET (?page=&search=&client=&from=&to=): the batches, newest first, 50 to a page. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = BatchesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.historyFailed }, { status: 400 })
  }
  try {
    const page = await listBatches(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Batches retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Client Voice Batches Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.historyFailed) }, { status: 500 })
  }
}

/**
 * POST { clientId?, voiceCount }: starts a batch, before a single voice is written out, so every
 * recording and transcript that follows has somewhere to be kept even if the task step never runs.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = StartBatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_VOICES_MESSAGES.batchFailed }, { status: 400 })
  }
  try {
    const batch = await startBatch(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Batch started", data: batch }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Client Voice Batch Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.batchFailed) }, { status: 500 })
  }
}

export const POST = withIdempotency("client-voice-batches", handlePost)

/**
 * DELETE ({ ids } or { all: true }, with the list's filters): deletes those batches with their
 * recordings and transcripts. Final, so the page only ever sends it from a confirmation.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const query = BatchesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!query.success || !body.success) {
    const problem = query.success ? body.error?.issues[0]?.message : query.error.issues[0]?.message
    return NextResponse.json({ success: false, message: problem || CLIENT_VOICES_MESSAGES.deleteBatchFailed }, { status: 400 })
  }
  try {
    const result = await deleteBatches(auth.viewer, query.data, body.data.ids)
    return NextResponse.json({ success: true, message: CLIENT_VOICES_MESSAGES.batchDeleted, data: result })
  } catch (error: unknown) {
    console.error("DELETE Client Voice Batches Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.deleteBatchFailed) }, { status: 500 })
  }
}

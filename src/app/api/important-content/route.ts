import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ImportantContentQuerySchema, ImportantContentSchema } from "@/lib/validation/importantContent"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { createEntry, deleteEntries, listEntries } from "@/services/importantContent/entries"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** GET (?page=&search=&type=): One page of 50 entries, newest first, with every type the account uses. */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ImportantContentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || IMPORTANT_CONTENT_MESSAGES.loadFailed }, { status: 400 })
  }
  try {
    const page = await listEntries(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Content retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Important Content Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST: Saves one entry to this account. */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ImportantContentSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || IMPORTANT_CONTENT_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const entry = await createEntry(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: IMPORTANT_CONTENT_MESSAGES.created, data: entry }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Important Content Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("important-content", handlePost)

/**
 * DELETE (?search=&type=, body `{ ids }` or `{ all: true }`): removes several entries at once, the
 * ticked ones or everything the filters cover, always inside what the viewer may see. Final.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const filters = ImportantContentQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!filters.success || !body.success) {
    const issue = filters.success ? body.error?.issues[0]?.message : filters.error.issues[0]?.message
    return NextResponse.json({ success: false, message: issue || IMPORTANT_CONTENT_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const { deleted } = await deleteEntries(auth.viewer, filters.data, body.data.ids)
    return NextResponse.json({ success: true, message: `${deleted} ${deleted === 1 ? "entry" : "entries"} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Important Content (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

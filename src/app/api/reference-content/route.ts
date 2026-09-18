import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ReferenceItemSchema } from "@/lib/validation/referenceItem"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { REFERENCE_CONTENT_MESSAGES, REFERENCE_SEARCH_MAX_LENGTH } from "@/constants/referenceContent"
import { createItem, deleteItems, listItems } from "@/services/referenceContent/items"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * GET (?search=&cursor=): One batch of saved content, newest first, for the current search.
 * The service caps the batch at REFERENCE_PAGE_SIZE (50), whatever is asked for.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const search = (req.nextUrl.searchParams.get("search") ?? "").slice(0, REFERENCE_SEARCH_MAX_LENGTH)
    const page = await listItems(auth.viewer, { search, cursor: req.nextUrl.searchParams.get("cursor") })
    return NextResponse.json({ success: true, message: "Saved content retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Reference Content Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, REFERENCE_CONTENT_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * POST: Saves one new piece of reference content.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ReferenceItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || REFERENCE_CONTENT_MESSAGES.missingContent },
        { status: 400 }
      )
    }

    const item = await createItem(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: REFERENCE_CONTENT_MESSAGES.created, data: item }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Reference Content Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, REFERENCE_CONTENT_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("reference-content", handlePost)

/**
 * DELETE (?search=, body `{ ids }` or `{ all: true }`): removes several saved pieces at once, the
 * ticked ones or everything the search covers, always inside what the viewer may see. Final.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ success: false, message: body.error.issues[0]?.message || REFERENCE_CONTENT_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const search = req.nextUrl.searchParams.get("search") ?? ""
    const { deleted } = await deleteItems(auth.viewer, search, body.data.ids)
    return NextResponse.json({ success: true, message: `${deleted} ${deleted === 1 ? "item" : "items"} deleted.`, data: { deleted } })
  } catch (error: unknown) {
    console.error("DELETE Reference Content (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, REFERENCE_CONTENT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

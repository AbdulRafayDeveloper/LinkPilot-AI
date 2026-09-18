import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import {
  ASSET_CATEGORY_IDS,
  ASSET_SEARCH_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
  type AssetFilterId,
} from "@/constants/importantFiles"
import { deleteAssets, listAssets } from "@/services/importantFiles/assets"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const filterFrom = (value: string | null): AssetFilterId =>
  (ASSET_CATEGORY_IDS as readonly string[]).includes(value ?? "") ? (value as AssetFilterId) : "all"

/**
 * GET (?search=&type=&cursor=): One batch of stored files, newest first, for the current search
 * and type filter. The service caps the batch at ASSET_PAGE_SIZE, whatever is asked for, and
 * returns only metadata plus a short-lived preview link, never the file itself.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const params = req.nextUrl.searchParams
    const page = await listAssets(auth.viewer, {
      search: (params.get("search") ?? "").slice(0, ASSET_SEARCH_MAX_LENGTH),
      type: filterFrom(params.get("type")),
      cursor: params.get("cursor"),
    })
    return NextResponse.json({ success: true, message: "Files retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Important Files Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE (?search=&type=, body `{ ids }` or `{ all: true }`): removes several files at once, the
 * ticked ones or every file the filters cover. Each file's object goes from storage before its
 * record, so a storage failure leaves the file listed rather than losing track of it; the answer
 * says how many went and how many could not be removed. Final.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = BulkDeleteSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ success: false, message: body.error.issues[0]?.message || IMPORTANT_FILES_MESSAGES.deleteFailed }, { status: 400 })
  }
  try {
    const params = req.nextUrl.searchParams
    const filters = {
      search: (params.get("search") ?? "").slice(0, ASSET_SEARCH_MAX_LENGTH),
      type: filterFrom(params.get("type")),
    }
    const { deleted, failed } = await deleteAssets(auth.viewer, filters, body.data.ids)
    const message =
      failed > 0
        ? `${deleted} ${deleted === 1 ? "file" : "files"} deleted. ${failed} could not be removed from storage and ${failed === 1 ? "is" : "are"} still listed.`
        : `${deleted} ${deleted === 1 ? "file" : "files"} deleted.`
    return NextResponse.json({ success: true, message, data: { deleted, failed } })
  } catch (error: unknown) {
    console.error("DELETE Important Files (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import {
  ASSET_CATEGORY_IDS,
  ASSET_SEARCH_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
  type AssetFilterId,
} from "@/constants/importantFiles"
import { listAssets } from "@/services/importantFiles/assets"

export const dynamic = "force-dynamic"

const filterFrom = (value: string | null): AssetFilterId =>
  (ASSET_CATEGORY_IDS as readonly string[]).includes(value ?? "") ? (value as AssetFilterId) : "all"

/**
 * GET (?search=&type=&cursor=): One batch of stored files, newest first, for the current search
 * and type filter. The service caps the batch at ASSET_PAGE_SIZE, whatever is asked for, and
 * returns only metadata plus a short-lived preview link, never the file itself.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const page = await listAssets({
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

import { NextRequest, NextResponse } from "next/server"
import { statusFor, toUserFacingMessage } from "@/lib/errors"
import {
  ASSET_CATEGORY_IDS,
  ASSET_SEARCH_MAX_LENGTH,
  DRIVE_FOLDER_MESSAGES,
  EVERY_FOLDER,
  IMPORTANT_FILES_MESSAGES,
  type AssetFilterId,
} from "@/constants/importantFiles"
import { deleteAssets, listAssets, moveAssets, type DriveScope } from "@/services/importantFiles/assets"
import { BulkDeleteSchema } from "@/lib/validation/listFilters"
import { MoveAssetsSchema } from "@/lib/validation/importantFile"
import { FolderProblem } from "@/services/importantFiles/folders"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const filterFrom = (value: string | null): AssetFilterId =>
  (ASSET_CATEGORY_IDS as readonly string[]).includes(value ?? "") ? (value as AssetFilterId) : "all"

/**
 * Which folder the page is looking at: `root` for the top of the drive, a folder's id, and
 * everything else (including nothing at all) for the whole drive, which is what every caller
 * written before folders asks for without knowing it.
 */
const folderFrom = (value: string | null): DriveScope => {
  if (value === "root") return null
  return /^[0-9a-f]{24}$/.test(value ?? "") ? (value as string) : EVERY_FOLDER
}

/**
 * GET (?search=&type=&cursor=&folder=): One batch of stored files, newest first, for the folder
 * being looked at and the current search and type filter. The service caps the batch at
 * ASSET_PAGE_SIZE, whatever is asked for, and returns only metadata plus a short-lived preview
 * link, never the file itself.
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
      folder: folderFrom(params.get("folder")),
    })
    return NextResponse.json({ success: true, message: "Files retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Important Files Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.loadFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

/**
 * DELETE (?search=&type=&folder=, body `{ ids }` or `{ all: true }`): removes several files at once,
 * the ticked ones or every file the filters and the open folder cover. Each file's object goes from storage before its
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
      folder: folderFrom(params.get("folder")),
    }
    const { deleted, failed } = await deleteAssets(auth.viewer, filters, body.data.ids)
    const message =
      failed > 0
        ? `${deleted} ${deleted === 1 ? "file" : "files"} deleted. ${failed} could not be removed from storage and ${failed === 1 ? "is" : "are"} still listed.`
        : `${deleted} ${deleted === 1 ? "file" : "files"} deleted.`
    return NextResponse.json({ success: true, message, data: { deleted, failed } })
  } catch (error: unknown) {
    console.error("DELETE Important Files (bulk) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.deleteFailed) }, { status: statusFor(error, 500) })
  }
}

/**
 * PUT `{ ids, folderId }`: files several files in one folder at once, for the picked files and for
 * one dragged onto a folder. It is one write, it never touches what is stored, and a folder that has
 * gone is reported rather than leaving the files half moved.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = MoveAssetsSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json(
      { success: false, message: body.error.issues[0]?.message || DRIVE_FOLDER_MESSAGES.moveFailed },
      { status: 400 }
    )
  }
  try {
    const moved = await moveAssets(auth.viewer, body.data.ids, body.data.folderId)
    return NextResponse.json({ success: true, message: DRIVE_FOLDER_MESSAGES.movedMany(moved), data: { moved } })
  } catch (error: unknown) {
    if (error instanceof FolderProblem) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("PUT Important Files (move) Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DRIVE_FOLDER_MESSAGES.moveFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

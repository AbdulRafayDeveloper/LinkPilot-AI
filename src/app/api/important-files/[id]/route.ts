import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AssetChangeSchema } from "@/lib/validation/importantFile"
import { IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import { deleteAsset, updateAssetMetadata } from "@/services/importantFiles/assets"
import { FolderProblem } from "@/services/importantFiles/folders"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT: Changes the name, the description and the folder the file is in. **Only the fields the body
 * carries are written**, so filing a file is `{ folderId }` on its own and never carries a stale
 * name over what another tab saved. The stored file is never touched here, so an edit can never swap
 * what sits behind a name.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = AssetChangeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || IMPORTANT_FILES_MESSAGES.missingName },
        { status: 400 }
      )
    }

    const asset = await updateAssetMetadata(auth.viewer, (await params).id, parsed.data)
    if (!asset) {
      return NextResponse.json({ success: false, message: IMPORTANT_FILES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: IMPORTANT_FILES_MESSAGES.updated, data: asset })
  } catch (error: unknown) {
    // A folder that has gone is the caller's to put right, not a failure of the save
    if (error instanceof FolderProblem) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("PUT Important File Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes the stored file and then its record, after the page has asked the user to
 * confirm. If S3 refuses, the record stays and the user is told, so the app never loses track
 * of a file that is still stored.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteAsset(auth.viewer, (await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: IMPORTANT_FILES_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: IMPORTANT_FILES_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Important File Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, IMPORTANT_FILES_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}

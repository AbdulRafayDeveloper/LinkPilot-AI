import { NextRequest, NextResponse } from "next/server"
import { statusFor, toUserFacingMessage } from "@/lib/errors"
import { DRIVE_FOLDER_MESSAGES } from "@/constants/importantFiles"
import { DriveFolderChangeSchema } from "@/lib/validation/importantFile"
import { changeDriveFolder, FolderProblem, removeDriveFolder } from "@/services/importantFiles/folders"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ folderId: string }> }

/**
 * One folder of the drive: renamed, moved under another folder, or deleted.
 *
 * Every write is held to the viewer's own folders by the service, so a folder id belonging to
 * another account answers as a folder that does not exist.
 */
const notFound = () => NextResponse.json({ success: false, message: DRIVE_FOLDER_MESSAGES.notFound }, { status: 404 })

/** PUT { name?, parentId? }: renames the folder, moves it, or both. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = DriveFolderChangeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || DRIVE_FOLDER_MESSAGES.renameFailed },
        { status: 400 }
      )
    }
    const folder = await changeDriveFolder(auth.viewer, (await params).folderId, parsed.data)
    if (!folder) return notFound()
    return NextResponse.json({ success: true, message: "Folder saved.", data: folder })
  } catch (error: unknown) {
    if (error instanceof FolderProblem) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.message === DRIVE_FOLDER_MESSAGES.duplicate ? 409 : 400 }
      )
    }
    console.error("PUT Drive Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DRIVE_FOLDER_MESSAGES.renameFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

/**
 * DELETE: removes the folder and brings what was inside it up one level, answering how many folders
 * and files were freed. **Nothing but the folder is deleted** and no file leaves storage.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const freed = await removeDriveFolder(auth.viewer, (await params).folderId)
    if (!freed) return notFound()
    return NextResponse.json({ success: true, message: DRIVE_FOLDER_MESSAGES.deleted, data: { deleted: true, ...freed } })
  } catch (error: unknown) {
    console.error("DELETE Drive Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DRIVE_FOLDER_MESSAGES.deleteFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

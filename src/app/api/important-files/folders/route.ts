import { NextRequest, NextResponse } from "next/server"
import { statusFor, toUserFacingMessage } from "@/lib/errors"
import { DRIVE_FOLDER_MESSAGES } from "@/constants/importantFiles"
import { DriveFolderSchema } from "@/lib/validation/importantFile"
import { createDriveFolder, FolderProblem, listDriveFolders, rootFileCount } from "@/services/importantFiles/folders"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * The folders Personal Drive files its files in.
 *
 * Both calls are scoped to the account by the service, so one account can never read or write
 * another's tree, and the feature gate covers them already: the path is under `/api/important-files`,
 * which `FEATURE_API_PATHS` maps to this tool.
 */

/**
 * GET: every folder of the drive, each with how much is filed in it and in everything inside it,
 * plus how many files sit at the top of the drive, so the top row carries its own count like every
 * folder does.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const [folders, rootCount] = await Promise.all([listDriveFolders(auth.viewer), rootFileCount(auth.viewer)])
    return NextResponse.json({ success: true, message: "Folders retrieved", data: { folders, rootCount } })
  } catch (error: unknown) {
    console.error("GET Drive Folders Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DRIVE_FOLDER_MESSAGES.createFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

/** POST { name, parentId? }: adds a folder, at the top of the drive or inside another. */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = DriveFolderSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || DRIVE_FOLDER_MESSAGES.createFailed },
        { status: 400 }
      )
    }
    const folder = await createDriveFolder(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: `Folder "${folder.name}" made.`, data: folder }, { status: 201 })
  } catch (error: unknown) {
    // What the tree itself refuses (a name already there, too deep, too many) is the caller's to fix
    if (error instanceof FolderProblem) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.message === DRIVE_FOLDER_MESSAGES.duplicate ? 409 : 400 }
      )
    }
    console.error("POST Drive Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DRIVE_FOLDER_MESSAGES.createFailed) },
      { status: statusFor(error, 500) }
    )
  }
}

// A retry of the same create (same Idempotency-Key) gets the first answer back instead of two folders
export const POST = withIdempotency("drive-folders", handlePost)

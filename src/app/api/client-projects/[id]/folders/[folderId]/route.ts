import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROJECT_FOLDER_MESSAGES, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { ProjectFolderChangeSchema } from "@/lib/validation/clientProjectTasks"
import { changeProjectFolder, FolderProblem, removeProjectFolder } from "@/services/clientProjects/folders"
import { projectOrNull } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * One folder of a project: renamed, moved under another folder, or deleted.
 *
 * Both calls name the project first and read it through the viewer's own scope, and every write is
 * then held to `{ _id, projectId }`, so a folder id belonging to another project matches nothing.
 */
const notFound = (message: string = PROJECT_FOLDER_MESSAGES.notFound) =>
  NextResponse.json({ success: false, message }, { status: 404 })

/** PUT { name?, parentId? }: renames the folder, moves it, or both. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; folderId: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id, folderId } = await params
    if (!(await projectOrNull(auth.viewer, id))) return notFound(PROJECT_TASK_MESSAGES.projectNotFound)
    const parsed = ProjectFolderChangeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROJECT_FOLDER_MESSAGES.renameFailed },
        { status: 400 }
      )
    }
    const folder = await changeProjectFolder(id, folderId, parsed.data)
    if (!folder) return notFound()
    return NextResponse.json({ success: true, message: "Folder saved.", data: folder })
  } catch (error: unknown) {
    if (error instanceof FolderProblem) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROJECT_FOLDER_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("PUT Project Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_FOLDER_MESSAGES.renameFailed) }, { status: 500 })
  }
}

/**
 * DELETE: removes the folder and brings what was inside it up one level, answering how many folders
 * and items were freed. Nothing but the folder is deleted.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; folderId: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id, folderId } = await params
    if (!(await projectOrNull(auth.viewer, id))) return notFound(PROJECT_TASK_MESSAGES.projectNotFound)
    const freed = await removeProjectFolder(id, folderId)
    if (!freed) return notFound()
    return NextResponse.json({ success: true, message: PROJECT_FOLDER_MESSAGES.deleted, data: { deleted: true, ...freed } })
  } catch (error: unknown) {
    console.error("DELETE Project Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_FOLDER_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

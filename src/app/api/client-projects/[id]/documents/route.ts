import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_FOLDER_MESSAGES, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { ProjectDocumentSchema } from "@/lib/validation/clientProjectTasks"
import { writeProjectDocument, deleteProjectFiles } from "@/services/clientProjects/files"
import { FolderProblem } from "@/services/clientProjects/folders"
import { addProjectTask, projectOrNull } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * POST { name, text, folderId? }: writes a document in the app instead of uploading one.
 *
 * The text is stored as one `.txt` file and the item is created with it in the same request, so a
 * note that belongs with the project's files is filed with them in one step. Everything after this
 * is the uploaded file's own code: the item, its preview, its download and its delete know nothing
 * about how the file arrived.
 *
 * **If the item cannot be saved the file is taken back out**, so a written document never leaves an
 * object in storage that nothing names.
 */
async function handlePost(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    const project = await projectOrNull(auth.viewer, id)
    if (!project) {
      return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })
    }
    const parsed = ProjectDocumentSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROJECT_FOLDER_MESSAGES.writeFailed },
        { status: 400 }
      )
    }

    const { name, text, folderId } = parsed.data
    const file = await writeProjectDocument({ id, ownerId: project.ownerId ?? auth.viewer.id }, { name, text })
    try {
      const item = await addProjectTask(auth.viewer, id, { content: name, kind: "document", files: [file], folderId })
      if (!item) throw new UserFacingError(PROJECT_TASK_MESSAGES.projectNotFound)
      return NextResponse.json({ success: true, message: PROJECT_FOLDER_MESSAGES.written, data: item }, { status: 201 })
    } catch (error: unknown) {
      await deleteProjectFiles([file])
      throw error
    }
  } catch (error: unknown) {
    if (error instanceof FolderProblem) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("POST Project Document Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_FOLDER_MESSAGES.writeFailed) }, { status: 500 })
  }
}

// A retry of the same write (same Idempotency-Key) gets the first answer back, never two documents
export const POST = withIdempotency("client-project-documents", handlePost)

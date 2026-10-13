import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PROJECT_FOLDER_MESSAGES, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { ProjectFolderSchema } from "@/lib/validation/clientProjectTasks"
import { createProjectFolder, FolderProblem, listProjectFolders } from "@/services/clientProjects/folders"
import { projectOrNull } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/**
 * The folders a project's documents and links are filed in.
 *
 * Both calls name the project first and read it through the viewer's own scope (`projectOrNull`),
 * so another account's project answers as no project at all and its folders can never be read or
 * written. The shared link has its own routes under `/api/public/projects/[token]`.
 */
const notFound = () => NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 })

/** GET (?kind=document): every folder of that tab, each with how much is filed in it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    if (!(await projectOrNull(auth.viewer, id))) return notFound()
    const kind = req.nextUrl.searchParams.get("kind") ?? undefined
    const folders = await listProjectFolders(id, kind)
    return NextResponse.json({ success: true, message: "Folders retrieved", data: { folders } })
  } catch (error: unknown) {
    console.error("GET Project Folders Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST { kind, name, parentId? }: adds a folder, at the top of the tab or inside another. */
async function handlePost(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    const project = await projectOrNull(auth.viewer, id)
    if (!project) return notFound()
    const parsed = ProjectFolderSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROJECT_FOLDER_MESSAGES.createFailed },
        { status: 400 }
      )
    }
    const folder = await createProjectFolder(id, project.ownerId ?? auth.viewer.dataOwnerId, parsed.data)
    return NextResponse.json({ success: true, message: `Folder "${folder.name}" made.`, data: folder }, { status: 201 })
  } catch (error: unknown) {
    // What the tree itself refuses (a name already there, too deep, too many) is the caller's to fix
    if (error instanceof FolderProblem) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROJECT_FOLDER_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("POST Project Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_FOLDER_MESSAGES.createFailed) }, { status: 500 })
  }
}

// A retry of the same create (same Idempotency-Key) gets the first answer back instead of two folders
export const POST = withIdempotency("client-project-folders", handlePost)

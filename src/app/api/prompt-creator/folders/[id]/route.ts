import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { FolderNameSchema } from "@/lib/validation/promptFolders"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { deleteFolder, renameFolder } from "@/services/promptCreator/folders"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: PROMPT_FOLDER_MESSAGES.notFound }, { status: 404 })

/** PUT (body: { name }): Renames one folder. A name another folder has answers 409. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = FolderNameSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_FOLDER_MESSAGES.renameFailed }, { status: 400 })
  }

  try {
    const folder = await renameFolder(auth.viewer, (await params).id, parsed.data.name)
    return folder ? NextResponse.json({ success: true, message: "Folder renamed.", data: folder }) : notFound()
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROMPT_FOLDER_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("PUT Prompt Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_FOLDER_MESSAGES.renameFailed) }, { status: 500 })
  }
}

/**
 * DELETE: Removes one folder. The prompts in it are kept and go back to no folder, so deleting a
 * folder can never lose a prompt.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const result = await deleteFolder(auth.viewer, (await params).id)
    if (!result) return notFound()
    return NextResponse.json({
      success: true,
      message: result.freed > 0 ? `Folder deleted. ${result.freed} ${result.freed === 1 ? "prompt is" : "prompts are"} now in no folder.` : "Folder deleted.",
      data: result,
    })
  } catch (error: unknown) {
    console.error("DELETE Prompt Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_FOLDER_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

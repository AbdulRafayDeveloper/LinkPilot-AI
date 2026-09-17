import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { FolderNameSchema } from "@/lib/validation/promptFolders"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import { createFolder, listFolders } from "@/services/promptCreator/folders"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: Every folder of created prompts, by name, each with how many prompts are in it. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const folders = await listFolders(auth.viewer)
    return NextResponse.json({ success: true, message: "Folders retrieved", data: { folders } })
  } catch (error: unknown) {
    console.error("GET Prompt Folders Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_FOLDER_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST (body: { name }): Adds a folder. A name already in use answers 409. */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = FolderNameSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROMPT_FOLDER_MESSAGES.createFailed }, { status: 400 })
  }

  try {
    const folder = await createFolder(auth.viewer, parsed.data.name)
    return NextResponse.json({ success: true, message: `Folder "${folder.name}" created.`, data: folder }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === PROMPT_FOLDER_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("POST Prompt Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROMPT_FOLDER_MESSAGES.createFailed) }, { status: 500 })
  }
}

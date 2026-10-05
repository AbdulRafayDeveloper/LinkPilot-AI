import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { FolderNameSchema } from "@/lib/validation/promptFolders"
import { CONTENT_FOLDER_MESSAGES } from "@/constants/contentFolders"
import { createFolder, listFolders } from "@/services/importantContent/folders"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

/** GET: Every folder of Important Content entries, by name, each with how many entries are in it. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const folders = await listFolders(auth.viewer)
    return NextResponse.json({ success: true, message: "Folders retrieved", data: { folders } })
  } catch (error: unknown) {
    console.error("GET Content Folders Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CONTENT_FOLDER_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST (body: { name }): Adds a folder. A name already in use answers 409. */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = FolderNameSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CONTENT_FOLDER_MESSAGES.createFailed }, { status: 400 })
  }

  try {
    const folder = await createFolder(auth.viewer, parsed.data.name)
    return NextResponse.json({ success: true, message: `Folder "${folder.name}" created.`, data: folder }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.message === CONTENT_FOLDER_MESSAGES.duplicate ? 409 : 400 })
    }
    console.error("POST Content Folder Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CONTENT_FOLDER_MESSAGES.createFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of making a second folder
export const POST = withIdempotency("important-content-folders", handlePost)

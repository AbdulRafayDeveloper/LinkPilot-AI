import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ContentFolderIdSchema, ImportantContentSchema } from "@/lib/validation/importantContent"
import { UserFacingError } from "@/lib/errors"
import { CONTENT_FOLDER_MESSAGES } from "@/constants/contentFolders"
import { IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import { deleteEntry, moveEntry, updateEntry } from "@/services/importantContent/entries"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ success: false, message: IMPORTANT_CONTENT_MESSAGES.notFound }, { status: 404 })

/**
 * PUT: Replaces one entry's name, description and type, or, with a body of just `{ folderId }`,
 * files it in a folder (null takes it out of one) without touching what it says. Another account's
 * entry reads as not found.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = (await req.json().catch(() => null)) as unknown
  // Filing is its own small write, so a body that names only the folder never has to carry the text
  const filing = ContentFolderIdSchema.safeParse(body)
  if (filing.success) {
    try {
      const entry = await moveEntry(auth.viewer, (await params).id, filing.data.folderId)
      return entry ? NextResponse.json({ success: true, message: "Entry moved.", data: entry }) : notFound()
    } catch (error: unknown) {
      if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 404 })
      console.error("PUT Important Content folder Exception:", error instanceof Error ? error.message : error)
      return NextResponse.json({ success: false, message: toUserFacingMessage(error, CONTENT_FOLDER_MESSAGES.moveFailed) }, { status: 500 })
    }
  }
  const parsed = ImportantContentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || IMPORTANT_CONTENT_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const entry = await updateEntry(auth.viewer, (await params).id, parsed.data)
    return entry ? NextResponse.json({ success: true, message: IMPORTANT_CONTENT_MESSAGES.updated, data: entry }) : notFound()
  } catch (error: unknown) {
    console.error("PUT Important Content Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: Removes one entry. The page confirms first. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteEntry(auth.viewer, (await params).id)
    return removed ? NextResponse.json({ success: true, message: IMPORTANT_CONTENT_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Important Content Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, IMPORTANT_CONTENT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

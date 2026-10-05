import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { CHILDREN_MESSAGES } from "@/constants/children"
import { deleteChild } from "@/services/children"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * DELETE: removes one of this account's child accounts. Everything the child saved stays in the
 * parent's workspace, because every record it made was the parent's from the start.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    const removed = await deleteChild(auth.viewer, id)
    if (!removed) return NextResponse.json({ success: false, message: CHILDREN_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: CHILDREN_MESSAGES.deleted, data: { id } })
  } catch (error: unknown) {
    console.error("DELETE Child Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CHILDREN_MESSAGES.deleteFailed) }, { status: 400 })
  }
}

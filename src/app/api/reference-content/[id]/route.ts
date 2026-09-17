import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ReferenceItemSchema } from "@/lib/validation/referenceItem"
import { REFERENCE_CONTENT_MESSAGES } from "@/constants/referenceContent"
import { deleteItem, updateItem } from "@/services/referenceContent/items"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT: Replaces one item's name and text.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = ReferenceItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || REFERENCE_CONTENT_MESSAGES.missingContent },
        { status: 400 }
      )
    }

    const item = await updateItem(auth.viewer, (await params).id, parsed.data)
    if (!item) {
      return NextResponse.json({ success: false, message: REFERENCE_CONTENT_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: REFERENCE_CONTENT_MESSAGES.updated, data: item })
  } catch (error: unknown) {
    console.error("PUT Reference Content Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, REFERENCE_CONTENT_MESSAGES.saveFailed) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes one item, after the page has asked the user to confirm.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const removed = await deleteItem(auth.viewer, (await params).id)
    if (!removed) {
      return NextResponse.json({ success: false, message: REFERENCE_CONTENT_MESSAGES.notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: REFERENCE_CONTENT_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Reference Content Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, REFERENCE_CONTENT_MESSAGES.deleteFailed) },
      { status: 500 }
    )
  }
}

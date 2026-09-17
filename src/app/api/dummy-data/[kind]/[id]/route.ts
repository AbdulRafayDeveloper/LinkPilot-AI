import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DummyDataKindSchema, dummyItemInputSchema } from "@/lib/validation/dummyData"
import { DUMMY_DATA_KINDS, dummyDataMessages } from "@/constants/dummyData"
import { deleteDummyItem, updateDummyItem } from "@/services/dummyData"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ kind: string; id: string }> }

const unknownKind = () => NextResponse.json({ success: false, message: "Unknown dummy data kind" }, { status: 404 })

/**
 * PUT: Replaces one item's name and text. Other items are untouched.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  const { kind: rawKind, id } = await params
  const kind = DummyDataKindSchema.safeParse(rawKind)
  if (!kind.success) return unknownKind()
  try {
    const parsed = dummyItemInputSchema(kind.data).safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid item" }, { status: 400 })
    }
    const updated = await updateDummyItem(kind.data, id, parsed.data)
    if (!updated) {
      return NextResponse.json({ success: false, message: dummyDataMessages(kind.data).notFound }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: `${updated.name} saved.`, data: updated })
  } catch (error: unknown) {
    console.error("PUT Dummy Data Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, `Failed to save the dummy ${DUMMY_DATA_KINDS[kind.data].item}`) },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Removes one item's file.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  const { kind: rawKind, id } = await params
  const kind = DummyDataKindSchema.safeParse(rawKind)
  if (!kind.success) return unknownKind()
  try {
    if (!(await deleteDummyItem(kind.data, id))) {
      return NextResponse.json({ success: false, message: dummyDataMessages(kind.data).notFound }, { status: 404 })
    }
    const { item } = DUMMY_DATA_KINDS[kind.data]
    return NextResponse.json({ success: true, message: `Dummy ${item} removed.`, data: { id } })
  } catch (error: unknown) {
    console.error("DELETE Dummy Data Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, `Failed to remove the dummy ${DUMMY_DATA_KINDS[kind.data].item}`) },
      { status: 500 }
    )
  }
}

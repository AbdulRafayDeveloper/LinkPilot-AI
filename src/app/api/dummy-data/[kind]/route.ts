import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DummyDataKindSchema, dummyItemInputSchema } from "@/lib/validation/dummyData"
import { DUMMY_DATA_KINDS } from "@/constants/dummyData"
import { createDummyItem, listDummyItems } from "@/services/dummyData"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ kind: string }> }

const unknownKind = () => NextResponse.json({ success: false, message: "Unknown dummy data kind" }, { status: 404 })

/**
 * GET: Every item of one Dummy Data kind (profiles, posts, ...), oldest first.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  const kind = DummyDataKindSchema.safeParse((await params).kind)
  if (!kind.success) return unknownKind()
  try {
    const items = await listDummyItems(kind.data)
    return NextResponse.json({ success: true, message: "Dummy data retrieved", data: items })
  } catch (error: unknown) {
    console.error("GET Dummy Data Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, `Failed to load the dummy ${DUMMY_DATA_KINDS[kind.data].item}s`) },
      { status: 500 }
    )
  }
}

/**
 * POST: Adds a new item to the dummy_data collection.
 */
async function handlePost(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  const kind = DummyDataKindSchema.safeParse((await params).kind)
  if (!kind.success) return unknownKind()
  try {
    const parsed = dummyItemInputSchema(kind.data).safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid item" }, { status: 400 })
    }
    const created = await createDummyItem(kind.data, parsed.data)
    return NextResponse.json({ success: true, message: `${created.name} added.`, data: created }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Dummy Data Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, `Failed to add the dummy ${DUMMY_DATA_KINDS[kind.data].item}`) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("dummy-data", handlePost)

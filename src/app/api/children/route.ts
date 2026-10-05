import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { withIdempotency } from "@/services/idempotency"
import { ChildSchema } from "@/lib/validation/children"
import { CHILDREN_MESSAGES } from "@/constants/children"
import { createChild, listChildren } from "@/services/children"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: this account's child accounts, with what each may open and what it may still be granted. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const page = await listChildren(auth.viewer)
    return NextResponse.json({ success: true, message: "Child accounts retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Children Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CHILDREN_MESSAGES.loadFailed) }, { status: 400 })
  }
}

/**
 * POST: creates one child account under this one. It starts with no tools, so the parent grants
 * what it needs afterwards, and it is always a `user`.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ChildSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CHILDREN_MESSAGES.createFailed }, { status: 400 })
  }
  try {
    const child = await createChild(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: CHILDREN_MESSAGES.created, data: child })
  } catch (error: unknown) {
    console.error("POST Child Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CHILDREN_MESSAGES.createFailed) }, { status: 400 })
  }
}

export const POST = withIdempotency("children", handlePost)

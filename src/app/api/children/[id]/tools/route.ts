import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ChildToolsSchema } from "@/lib/validation/children"
import { CHILDREN_MESSAGES } from "@/constants/children"
import { setChildTools } from "@/services/children"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: grants or takes back the named tools for one child. It names only the tools it touches, and
 * a tool the parent does not have itself is refused, so a child can never be given more than its parent.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = ChildToolsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CHILDREN_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const child = await setChildTools(auth.viewer, id, parsed.data)
    if (!child) return NextResponse.json({ success: false, message: CHILDREN_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Saved", data: child })
  } catch (error: unknown) {
    console.error("PUT Child Tools Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CHILDREN_MESSAGES.saveFailed) }, { status: 400 })
  }
}

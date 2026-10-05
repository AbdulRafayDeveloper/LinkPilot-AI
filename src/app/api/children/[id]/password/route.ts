import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ChildPasswordSchema } from "@/lib/validation/children"
import { CHILDREN_MESSAGES } from "@/constants/children"
import { setChildPassword } from "@/services/children"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: sets a new password for one child. It ends every sign-in that child has and leaves the
 * parent's own password and session alone.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = ChildPasswordSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CHILDREN_MESSAGES.passwordFailed }, { status: 400 })
  }
  try {
    const changed = await setChildPassword(auth.viewer, id, parsed.data.password)
    if (!changed) return NextResponse.json({ success: false, message: CHILDREN_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: CHILDREN_MESSAGES.passwordChanged, data: { id } })
  } catch (error: unknown) {
    console.error("PUT Child Password Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CHILDREN_MESSAGES.passwordFailed) }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { requireViewer } from "@/services/auth/viewer"
import { changeFeatureAccess, readFeatureAccess } from "@/services/admin/featureAccess"
import { FeatureAccessChangeSchema } from "@/lib/validation/featureAccess"
import { FEATURE_ACCESS_MESSAGES } from "@/constants/featureAccess"

export const dynamic = "force-dynamic"

/**
 * GET: which tools one account may use: the settings for every user, its own choices on top, and
 * the result. PUT (body `{ tools, on }` or `{ reset: true }`): sets some tools on or off for this
 * account alone, or drops all of its own choices so it follows everyone again. Admins only, and an
 * admin's own tools are never turned off, so nobody can be locked out of here. A change takes
 * effect on that account's next request, without signing it out.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    const { id } = await params
    const access = await readFeatureAccess(id)
    if (!access) return NextResponse.json({ success: false, message: FEATURE_ACCESS_MESSAGES.accountGone }, { status: 404 })
    return NextResponse.json({ success: true, message: "Feature access", data: access })
  } catch (error: unknown) {
    console.error("GET Feature Access Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FEATURE_ACCESS_MESSAGES.loadFailed) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = FeatureAccessChangeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || FEATURE_ACCESS_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const { id } = await params
    const result = await changeFeatureAccess(id, parsed.data)
    if ("error" in result) {
      if (result.error === "missing") return NextResponse.json({ success: false, message: FEATURE_ACCESS_MESSAGES.accountGone }, { status: 404 })
      const message = result.error === "admin" ? FEATURE_ACCESS_MESSAGES.adminsKeepEverything : FEATURE_ACCESS_MESSAGES.unknownTool
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: FEATURE_ACCESS_MESSAGES.saved, data: result.access })
  } catch (error: unknown) {
    console.error("PUT Feature Access Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FEATURE_ACCESS_MESSAGES.saveFailed) }, { status: 500 })
  }
}

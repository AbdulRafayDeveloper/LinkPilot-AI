import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { requireViewer } from "@/services/auth/viewer"
import { changeDefaultsForAdmin, readDefaultsForAdmin } from "@/services/admin/featureAccess"
import { FeatureDefaultsChangeSchema } from "@/lib/validation/featureAccess"
import { FEATURE_ACCESS_MESSAGES } from "@/constants/featureAccess"

export const dynamic = "force-dynamic"

/**
 * GET: the tools turned off for every user, and how many accounts have choices of their own.
 * PUT (body `{ tools, on }`): turns those tools on or off for every user at once; an account with a
 * choice of its own for a tool keeps it. Admins only; admins themselves always keep every tool.
 */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Tools for every user", data: await readDefaultsForAdmin() })
  } catch (error: unknown) {
    console.error("GET Feature Defaults Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FEATURE_ACCESS_MESSAGES.loadFailed) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = FeatureDefaultsChangeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || FEATURE_ACCESS_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const result = await changeDefaultsForAdmin(parsed.data, auth.viewer.email)
    if ("error" in result) return NextResponse.json({ success: false, message: FEATURE_ACCESS_MESSAGES.unknownTool }, { status: 400 })
    return NextResponse.json({ success: true, message: FEATURE_ACCESS_MESSAGES.savedForEveryone, data: result.defaults })
  } catch (error: unknown) {
    console.error("PUT Feature Defaults Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FEATURE_ACCESS_MESSAGES.saveFailed) }, { status: 500 })
  }
}

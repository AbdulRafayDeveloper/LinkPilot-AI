import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BUDGET_MESSAGES } from "@/constants/budget"
import { SettingsSchema } from "@/lib/validation/budget"
import { saveSettings } from "@/services/budget/budget"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** PUT: the base currency, the opening balance, how what is left is split, and the participants. */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = SettingsSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || BUDGET_MESSAGES.settingsFailed }, { status: 400 })
    const settings = await saveSettings(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: BUDGET_MESSAGES.settingsSaved, data: settings })
  } catch (error: unknown) {
    console.error("PUT Budget Settings Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BUDGET_MESSAGES.settingsFailed) }, { status: 500 })
  }
}

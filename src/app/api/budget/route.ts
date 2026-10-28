import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BUDGET_MESSAGES } from "@/constants/budget"
import { getLedger } from "@/services/budget/budget"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: the person's own budget, the settings and every month recorded, oldest first. Every total is
 * worked out on the page from this (lib/budget.ts), so the report, a month and an export always agree.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Budget retrieved", data: await getLedger(auth.viewer) })
  } catch (error: unknown) {
    console.error("GET Budget Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BUDGET_MESSAGES.loadFailed) }, { status: 500 })
  }
}

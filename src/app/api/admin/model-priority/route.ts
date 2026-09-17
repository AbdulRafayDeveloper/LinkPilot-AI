import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import { getModelPriorities } from "@/services/modelPriority"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Admin only. Every module that calls an AI model with the provider order it uses for admins,
 * and what each provider is configured to do on this deployment (never a key or a value).
 */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Model priorities retrieved", data: await getModelPriorities() })
  } catch (error: unknown) {
    console.error("GET Model Priority Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MODEL_PRIORITY_MESSAGES.loadFailed) }, { status: 500 })
  }
}

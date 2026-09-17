import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AiModuleSchema, ModelPriorityInputSchema } from "@/lib/validation/modelPriority"
import { DEFAULT_MODEL_ORDER } from "@/constants/aiProviders"
import { MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import { getModelPriorities, saveModelPriority } from "@/services/modelPriority"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ module: string }> }

/**
 * PUT { order }: Admin only. Sets the order a module tries the providers in, for admins' requests.
 * Every provider must be listed exactly once. Regular users keep the default order whatever is set.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const aiModule = AiModuleSchema.safeParse((await params).module)
  if (!aiModule.success) return NextResponse.json({ success: false, message: MODEL_PRIORITY_MESSAGES.unknownModule }, { status: 404 })
  const parsed = ModelPriorityInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || MODEL_PRIORITY_MESSAGES.badOrder }, { status: 400 })
  }
  try {
    await saveModelPriority(auth.viewer, aiModule.data, parsed.data.order)
    return NextResponse.json({ success: true, message: "Order saved", data: await getModelPriorities() })
  } catch (error: unknown) {
    console.error("PUT Model Priority Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MODEL_PRIORITY_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: Admin only. Puts a module back on the default order (Groq first). */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const aiModule = AiModuleSchema.safeParse((await params).module)
  if (!aiModule.success) return NextResponse.json({ success: false, message: MODEL_PRIORITY_MESSAGES.unknownModule }, { status: 404 })
  try {
    await saveModelPriority(auth.viewer, aiModule.data, DEFAULT_MODEL_ORDER)
    return NextResponse.json({ success: true, message: "Default order restored", data: await getModelPriorities() })
  } catch (error: unknown) {
    console.error("DELETE Model Priority Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MODEL_PRIORITY_MESSAGES.saveFailed) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ModelPriceKeySchema, ModelPriceSchema } from "@/lib/validation/aiCosts"
import { AI_COST_MESSAGES } from "@/constants/aiCosts"
import { listModelPrices, removeModelPrice, saveModelPrice } from "@/services/aiCosts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const invalid = (message: string | undefined, fallback: string) =>
  NextResponse.json({ success: false, message: message || fallback }, { status: 400 })

/** GET: Admin only. Every priced model and every model used without a price, most used first. */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Prices retrieved", data: await listModelPrices() })
  } catch (error: unknown) {
    console.error("GET Model Prices Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AI_COST_MESSAGES.pricesFailed) }, { status: 500 })
  }
}

/**
 * PUT { provider, model, inputPerMillion, outputPerMillion, perAudioMinute, perCall }: Admin only.
 * Sets one model's prices for every call from now on; a repeat lands on the same prices.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = ModelPriceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message, AI_COST_MESSAGES.saveFailed)
  try {
    await saveModelPrice(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Price saved", data: await listModelPrices() })
  } catch (error: unknown) {
    console.error("PUT Model Price Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AI_COST_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE { provider, model }: Admin only. Takes a model's price off; what was spent stays saved. */
export async function DELETE(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = ModelPriceKeySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message, AI_COST_MESSAGES.removeFailed)
  try {
    await removeModelPrice(parsed.data.provider, parsed.data.model)
    return NextResponse.json({ success: true, message: "Price removed", data: await listModelPrices() })
  } catch (error: unknown) {
    console.error("DELETE Model Price Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, AI_COST_MESSAGES.removeFailed) }, { status: 500 })
  }
}

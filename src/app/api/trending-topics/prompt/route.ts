import { NextRequest, NextResponse } from "next/server"
import { UserFacingError } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getActiveTrendingPrompt, getDefaultTrendingPrompt, saveTrendingPrompt } from "@/services/trending/prompt"

export const dynamic = "force-dynamic"

function errorResponse(error: unknown, fallbackMessage: string) {
  const isUserFacing = error instanceof UserFacingError
  return NextResponse.json(
    { success: false, message: isUserFacing ? error.message : fallbackMessage },
    { status: isUserFacing ? 503 : 500 }
  )
}

/**
 * GET: Returns the exact prompt the Trending Topics search currently uses, plus the default.
 */
export async function GET() {
  try {
    const active = await getActiveTrendingPrompt()
    return NextResponse.json({
      success: true,
      message: "Active trending topics prompt retrieved",
      data: { ...active, defaultPrompt: getDefaultTrendingPrompt() },
    })
  } catch (error: unknown) {
    console.error("GET Trending Prompt Exception:", error)
    return errorResponse(error, "Failed to load the trending topics prompt")
  }
}

/**
 * PUT: Persists an updated prompt. The next search uses it without any code change.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveTrendingPrompt(parsed.data.prompt)
    return NextResponse.json({
      success: true,
      message: "Prompt saved. Your next search will use it.",
      data: { ...saved, defaultPrompt: getDefaultTrendingPrompt() },
    })
  } catch (error: unknown) {
    console.error("PUT Trending Prompt Exception:", error)
    return errorResponse(error, "Failed to save the trending topics prompt")
  }
}

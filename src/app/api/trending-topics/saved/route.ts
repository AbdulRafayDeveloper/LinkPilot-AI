import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { TRENDING_MESSAGES } from "@/constants/trending"
import { clearSavedTrendingResult, readSavedTrendingResult } from "@/services/trending/savedTopics"

export const dynamic = "force-dynamic"

/**
 * GET: The latest search anyone ran (src/data/trending-topics/latest.md), or null after a Reset.
 */
export async function GET() {
  try {
    const result = await readSavedTrendingResult()
    return NextResponse.json({ success: true, message: result ? "Saved topics loaded." : "No saved topics.", data: { result } })
  } catch (error: unknown) {
    console.error("GET Saved Trending Topics Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TRENDING_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/**
 * DELETE: Reset. Removes the saved topics for everyone.
 */
export async function DELETE() {
  try {
    await clearSavedTrendingResult()
    return NextResponse.json({ success: true, message: "Saved topics removed.", data: { result: null } })
  } catch (error: unknown) {
    console.error("DELETE Saved Trending Topics Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TRENDING_MESSAGES.clearFailed) }, { status: 500 })
  }
}

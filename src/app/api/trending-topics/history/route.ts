import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { SavedTopicsQuerySchema } from "@/lib/validation/trendingHistory"
import { TRENDING_HISTORY_MESSAGES } from "@/constants/trending"
import { listSavedTopics } from "@/services/trending/history"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET (?page=&search=&category=&format=&status=&from=&to=): One page of every topic every search
 * has found, 50 at a time, filtered and counted in the database. Read-only, like the saved search
 * the Trending Topics page loads, so it is open the same way.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = SavedTopicsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || TRENDING_HISTORY_MESSAGES.loadFailed },
      { status: 400 }
    )
  }

  try {
    const page = await listSavedTopics(auth.viewer, parsed.data)
    return NextResponse.json({ success: true, message: "Saved topics retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Trending Topics History Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, TRENDING_HISTORY_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

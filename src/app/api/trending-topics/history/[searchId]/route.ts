import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { SavedTopicKeySchema } from "@/lib/validation/trendingHistory"
import { TRENDING_HISTORY_MESSAGES } from "@/constants/trending"
import { deleteSavedTopic, getSavedTopic } from "@/services/trending/history"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ searchId: string }> }

/**
 * GET (?title=): One saved topic in full, for its own view: every field the search page shows,
 * including its sources. A topic is named by its search and its title.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = SavedTopicKeySchema.safeParse({ title: req.nextUrl.searchParams.get("title") ?? undefined })
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || TRENDING_HISTORY_MESSAGES.topicGone }, { status: 400 })
  }

  try {
    const detail = await getSavedTopic(auth.viewer, (await params).searchId, parsed.data.title)
    if (!detail) return NextResponse.json({ success: false, message: TRENDING_HISTORY_MESSAGES.topicGone }, { status: 404 })
    return NextResponse.json({ success: true, message: "Topic retrieved", data: detail })
  } catch (error: unknown) {
    console.error("GET Saved Trending Topic Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TRENDING_HISTORY_MESSAGES.detailFailed) }, { status: 500 })
  }
}

/**
 * DELETE (body: { title }): Deletes one topic from its search, at once and with no confirmation.
 * A topic that is already gone, or belongs to a search the viewer may not see, answers 404.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = SavedTopicKeySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || TRENDING_HISTORY_MESSAGES.topicGone }, { status: 400 })
  }

  try {
    const removed = await deleteSavedTopic(auth.viewer, (await params).searchId, parsed.data.title)
    if (!removed) return NextResponse.json({ success: false, message: TRENDING_HISTORY_MESSAGES.topicGone }, { status: 404 })
    return NextResponse.json({ success: true, message: TRENDING_HISTORY_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE Saved Trending Topic Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TRENDING_HISTORY_MESSAGES.deleteFailed) }, { status: 500 })
  }
}

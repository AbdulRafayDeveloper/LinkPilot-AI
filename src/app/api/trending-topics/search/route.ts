import { NextRequest } from "next/server"
import { findTrendingTopics } from "@/services/trending"
import { saveTrendingResult } from "@/services/trending/savedTopics"
import { toUserFacingMessage } from "@/lib/errors"
import { createEventStream } from "@/lib/sse"
import { TRENDING_ERROR_MESSAGE } from "@/constants/trending"
import type { TrendingStreamEvent } from "@/services/trending/schema"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"

export const dynamic = "force-dynamic"
// Live web research plus ranking can take a couple of minutes on slower searches
export const maxDuration = 300

/**
 * POST: Runs a fresh live Trending Topics search and streams real pipeline stages
 * as Server-Sent Events, ending with a COMPLETE (validated result) or ERROR event.
 * Every search is added to the trending_searches history; one that found topics becomes
 * the topics everyone sees, one that found none leaves the previous topics on show.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  return createEventStream<TrendingStreamEvent>(async (send) => {
    try {
      const result = withSource(await runAiRequest(auth.viewer, "trending-topics", () => findTrendingTopics({
        signal: req.signal,
        onStage: (status, text) => send({ status, text }),
      })))
      // The search still counts when saving fails; it just isn't shared
      await saveTrendingResult(auth.viewer, result).catch((error: unknown) => {
        console.warn("⚠️ Couldn't save the Trending Topics:", error instanceof Error ? error.message : error)
      })
      send({ status: "COMPLETE", result })
    } catch (error: unknown) {
      if (!req.signal.aborted) {
        console.error("POST Trending Topics Search Exception:", error instanceof Error ? error.message : error)
        send({ status: "ERROR", message: toUserFacingMessage(error, TRENDING_ERROR_MESSAGE) })
      }
    }
  })
}

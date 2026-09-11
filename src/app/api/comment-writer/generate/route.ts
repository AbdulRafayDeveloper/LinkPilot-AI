import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { createEventStream } from "@/lib/sse"
import { parsePostInput } from "@/lib/validation/postInput"
import { COMMENT_TUNE_IDS, COMMENT_WRITER_MESSAGES } from "@/constants/commentWriter"
import { generateComment } from "@/services/commentWriter/generate"
import type { CommentStreamEvent } from "@/types/commentWriter"

export const dynamic = "force-dynamic"
// Reading a screenshot, live web research and writing can take a couple of minutes together
export const maxDuration = 300

const { missingPost, missingTune, generationFailed } = COMMENT_WRITER_MESSAGES

const TuneSchema = z.enum(COMMENT_TUNE_IDS, { error: missingTune })

/**
 * POST (multipart form: tune, inputMode, postText | image): writes one comment with the
 * latest saved prompt for the tune and streams the real pipeline stages as Server-Sent
 * Events, ending with COMPLETE (verified result) or ERROR. Invalid input returns 400 JSON.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const input = form ? await parsePostInput(form, { required: true, missingMessage: missingPost }) : { error: missingPost }
  if ("error" in input || !input.post) {
    return NextResponse.json({ success: false, message: "error" in input ? input.error : missingPost }, { status: 400 })
  }
  const tune = TuneSchema.safeParse(form?.get("tune"))
  if (!tune.success) {
    return NextResponse.json({ success: false, message: missingTune }, { status: 400 })
  }
  const post = input.post

  return createEventStream<CommentStreamEvent>(async (send) => {
    try {
      const result = await generateComment({
        tune: tune.data,
        post,
        signal: req.signal,
        onStage: (status, text) => send({ status, text }),
      })
      send({ status: "COMPLETE", result })
    } catch (error: unknown) {
      if (!req.signal.aborted) {
        console.error("POST Comment Writer Generate Exception:", error instanceof Error ? error.message : error)
        send({ status: "ERROR", message: toUserFacingMessage(error, generationFailed) })
      }
    }
  })
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { createEventStream } from "@/lib/sse"
import { parsePostInput } from "@/lib/validation/postInput"
import {
  POST_COMMENT_REPLY_MESSAGES,
  REPLY_COMMENTS_MAX_LENGTH,
  REPLY_CONTEXT_IDS,
  REPLY_STYLE_IDS,
} from "@/constants/postCommentReplies"
import { generatePostCommentReply, type ReplyInput } from "@/services/postCommentReplies/generate"
import type { ReplyStreamEvent } from "@/types/postCommentReplies"

export const dynamic = "force-dynamic"
// Reading a screenshot, optional live research (only when a prompt uses {{web_research}}) and a possible fallback call
export const maxDuration = 300

const MAX_AUTHOR_LENGTH = 120
const { missingComment, missingContext, missingStyle, commentsTooLong, generationFailed } = POST_COMMENT_REPLY_MESSAGES

const FieldsSchema = z.object({
  context: z.enum(REPLY_CONTEXT_IDS, { error: missingContext }),
  style: z.enum(REPLY_STYLE_IDS, { error: missingStyle }),
  comments: z
    .string({ error: missingComment })
    .trim()
    .min(1, missingComment)
    .max(REPLY_COMMENTS_MAX_LENGTH, commentsTooLong),
  targetComment: z
    .object({
      author: z.string().trim().max(MAX_AUTHOR_LENGTH).nullable(),
      text: z.string().trim().min(1).max(REPLY_COMMENTS_MAX_LENGTH),
    })
    .nullable()
    .catch(null),
})

function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function parseRequest(req: NextRequest): Promise<ReplyInput | { error: string }> {
  const form = await req.formData().catch(() => null)
  if (!form) return { error: missingComment }

  const fields = FieldsSchema.safeParse({
    context: form.get("context") ?? undefined,
    style: form.get("style") ?? undefined,
    comments: form.get("comments") ?? undefined,
    targetComment: parseJson(form.get("targetComment")),
  })
  if (!fields.success) return { error: fields.error.issues[0]?.message || missingComment }

  // The original post is optional: pasted text, a screenshot, or nothing
  const post = await parsePostInput(form, { required: false, missingMessage: missingComment })
  if ("error" in post) return { error: post.error }
  return { ...fields.data, post: post.post }
}

/**
 * POST (multipart form: context, style, comments, targetComment?, inputMode, postText | image):
 * generates one reply with the latest saved prompt for the exact context + style, streaming
 * real pipeline stages as Server-Sent Events and ending with COMPLETE or ERROR.
 */
export async function POST(req: NextRequest) {
  const input = await parseRequest(req)
  if ("error" in input) {
    return NextResponse.json({ success: false, message: input.error }, { status: 400 })
  }

  return createEventStream<ReplyStreamEvent>(async (send) => {
    try {
      const result = await generatePostCommentReply({
        input,
        signal: req.signal,
        onStage: (status) => send({ status }),
      })
      send({ status: "COMPLETE", result })
    } catch (error: unknown) {
      if (req.signal.aborted) return
      if (!(error instanceof UserFacingError)) {
        console.error("POST Post Comment Reply Exception:", error instanceof Error ? error.message : error)
      }
      send({ status: "ERROR", message: toUserFacingMessage(error, generationFailed) })
    }
  })
}

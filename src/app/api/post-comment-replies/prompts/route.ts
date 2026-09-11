import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getPostCommentReplyPrompts } from "@/services/postCommentReplies/prompts"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for all 14 context + style pairs.
 */
export async function GET() {
  try {
    const prompts = await getPostCommentReplyPrompts()
    return NextResponse.json({ success: true, message: "Post comment reply prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Post Comment Reply Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the reply prompts") },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getPostCommentReplyPrompts } from "@/services/postCommentReplies/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every context + style pair.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
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

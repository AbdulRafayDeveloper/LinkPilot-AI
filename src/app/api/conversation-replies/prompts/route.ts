import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getConversationReplyPrompts } from "@/services/conversationReply/prompts"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every reply type, plus About Me.
 */
export async function GET() {
  try {
    const prompts = await getConversationReplyPrompts()
    return NextResponse.json({ success: true, message: "Conversation reply prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Conversation Reply Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the conversation reply prompts") },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getCommentWriterPrompts } from "@/services/commentWriter/prompts"
import { requirePromptAccess } from "@/services/promptAccess"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every comment tune.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompts = await getCommentWriterPrompts()
    return NextResponse.json({ success: true, message: "Comment Writer prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Comment Writer Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the Comment Writer prompts") },
      { status: 500 }
    )
  }
}

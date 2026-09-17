import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getPromptCreatorPrompts } from "@/services/promptCreator/prompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every Prompt Creator target.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const prompts = await getPromptCreatorPrompts()
    return NextResponse.json({ success: true, message: "Prompt Creator prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Prompt Creator Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the Prompt Creator prompts") },
      { status: 500 }
    )
  }
}

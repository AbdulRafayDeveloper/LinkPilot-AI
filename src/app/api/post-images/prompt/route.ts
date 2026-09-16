import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { getPostImagePrompt, savePostImagePrompt } from "@/services/postImages/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

/**
 * GET: The prompt every post image is designed with, plus its default.
 */
export async function GET() {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const prompt = await getPostImagePrompt()
    return NextResponse.json({ success: true, message: "Post image prompt retrieved", data: prompt })
  } catch (error: unknown) {
    console.error("GET Post Image Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the post image prompt") },
      { status: 500 }
    )
  }
}

/**
 * PUT: Saves the prompt. The next image uses it, and images already made keep the words they
 * were drawn from on their own record.
 */
export async function PUT(req: NextRequest) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await savePostImagePrompt(parsed.data.prompt)
    return NextResponse.json({ success: true, message: "Prompt saved. Your next image will use it.", data: saved })
  } catch (error: unknown) {
    console.error("PUT Post Image Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}

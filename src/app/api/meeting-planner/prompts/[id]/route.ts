import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { PromptUpdateSchema } from "@/lib/validation/prompt"
import { MEETING_PLANNER_PROMPT_IDS } from "@/constants/meetingPlanner"
import { saveMeetingPlannerPrompt } from "@/services/meetingPlanner/prompts"
import { requirePromptAccess } from "@/services/promptAccess"

export const dynamic = "force-dynamic"

const PromptIdSchema = z.enum(MEETING_PLANNER_PROMPT_IDS)

/**
 * PUT: saves the preparation prompt. Meetings already prepared keep what they have; the new
 * text is used the next time a preparation is written.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePromptAccess()
  if (denied) return denied

  try {
    const id = PromptIdSchema.safeParse((await params).id)
    if (!id.success) {
      return NextResponse.json({ success: false, message: "Unknown prompt" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const parsed = PromptUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid prompt" },
        { status: 400 }
      )
    }

    const saved = await saveMeetingPlannerPrompt(id.data, parsed.data.prompt)
    return NextResponse.json({
      success: true,
      message: "Preparation prompt saved. The next preparation will use it.",
      data: saved,
    })
  } catch (error: unknown) {
    console.error("PUT Meeting Planner Prompt Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to save the prompt") },
      { status: 500 }
    )
  }
}

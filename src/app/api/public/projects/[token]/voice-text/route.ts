import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { writePublicVoiceText } from "@/services/clientProjects/voiceText"

export const dynamic = "force-dynamic"
export const maxDuration = 120

type RouteContext = { params: Promise<{ token: string }> }

const noStore = { "Cache-Control": "no-store" }

const VoiceTextSchema = z.object({ taskId: z.string().regex(/^[0-9a-f]{24}$/, PROJECT_TASK_MESSAGES.taskNotFound) })

/**
 * POST `{ taskId }`: the client writes one overview voice out in clear English from the shared link,
 * as the owner asked. The token is resolved afresh, so turning the link off stops it, and the item
 * must be on this project and on a tab the link may write on. The calls are counted for the owner.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const parsed = VoiceTextSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.taskNotFound }, { status: 400, headers: noStore })
  }
  try {
    const written = await writePublicVoiceText(token, parsed.data.taskId, req.signal)
    if (written.ok) return NextResponse.json({ success: true, message: "Written in English", data: written.value.task }, { headers: noStore })
    // A refusal about the link always reads the same; an item that is gone says so instead
    return written.reason === "link"
      ? NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })
      : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.taskNotFound }, { status: 404, headers: noStore })
  } catch (error: unknown) {
    if (req.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499, headers: noStore })
    if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400, headers: noStore })
    console.error("POST Public Project Voice Text Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.voiceTextFailed) }, { status: 500, headers: noStore })
  }
}

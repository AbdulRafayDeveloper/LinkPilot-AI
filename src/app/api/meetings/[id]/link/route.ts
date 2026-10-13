import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MeetingLinkSchema } from "@/lib/validation/meeting"
import { MEETING_LINK_MESSAGES, MEETING_MESSAGES } from "@/constants/meetings"
import { changeMeetingLink } from "@/services/meetings/publicLink"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST (body: { action }): makes the read-only link one meeting can be shared by, replaces it, or
 * turns it off. **replace** stops every earlier link at once; **disable** stops them all, and
 * turning it on again makes one nobody has seen. The answer carries the token, which the page puts
 * after its own origin, so the address is right on localhost and on the live site alike.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = MeetingLinkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || MEETING_LINK_MESSAGES.failed }, { status: 400 })
  }
  try {
    const result = await changeMeetingLink(auth.viewer, (await params).id, parsed.data.action)
    return result
      ? NextResponse.json({ success: true, message: MEETING_LINK_MESSAGES[parsed.data.action === "disable" ? "off" : parsed.data.action === "replace" ? "replaced" : "made"], data: result })
      : NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
  } catch (error: unknown) {
    console.error("POST Meeting Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_LINK_MESSAGES.failed) }, { status: 500 })
  }
}

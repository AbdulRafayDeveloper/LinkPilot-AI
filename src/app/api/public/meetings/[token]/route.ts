import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PUBLIC_MEETING_MESSAGES } from "@/constants/meetings"
import { readPublicMeeting } from "@/services/meetings/publicLink"

export const dynamic = "force-dynamic"

/**
 * One meeting, reachable without signing in (src/proxy.ts lets /api/public/ through), for whoever
 * the owner sent its link to. The signed token in the address is the only key, and it is the whole
 * of the caller's authority: it opens that one meeting and nothing else.
 *
 * **It only reads.** There is no POST, PUT or DELETE here and there is nothing to ask it: the link
 * exists so someone can watch the recording and read the summary. It never carries the transcript,
 * and never says whose account the meeting is or what else that account has.
 */

type RouteContext = { params: Promise<{ token: string }> }

const noStore = { "Cache-Control": "no-store" }

// Every refusal about the link reads the same, so a guessed token learns nothing
const invalidLink = () => NextResponse.json({ success: false, message: PUBLIC_MEETING_MESSAGES.invalid }, { status: 404, headers: noStore })

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  try {
    const meeting = await readPublicMeeting(token)
    if (!meeting) return invalidLink()
    return NextResponse.json({ success: true, message: "Meeting retrieved", data: meeting }, { headers: noStore })
  } catch (error: unknown) {
    console.error("GET Public Meeting Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PUBLIC_MEETING_MESSAGES.invalid) }, { status: 500, headers: noStore })
  }
}

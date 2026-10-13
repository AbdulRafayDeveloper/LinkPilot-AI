import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PUBLIC_MEETING_MESSAGES } from "@/constants/meetings"
import { publicRecordingLinks } from "@/services/meetings/publicLink"

export const dynamic = "force-dynamic"

/**
 * GET: signed links to play and download the shared meeting's recording. The token resolves the
 * meeting afresh on every call, so turning the link off stops the video at the same moment it
 * stops the page, and the bucket itself stays private: every link expires.
 */

type RouteContext = { params: Promise<{ token: string }> }

const noStore = { "Cache-Control": "no-store" }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  try {
    const links = await publicRecordingLinks(token)
    if (!links) return NextResponse.json({ success: false, message: PUBLIC_MEETING_MESSAGES.invalid }, { status: 404, headers: noStore })
    return NextResponse.json({ success: true, message: "Links", data: links }, { headers: noStore })
  } catch (error: unknown) {
    console.error("GET Public Meeting Recording Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PUBLIC_MEETING_MESSAGES.invalid) }, { status: 500, headers: noStore })
  }
}

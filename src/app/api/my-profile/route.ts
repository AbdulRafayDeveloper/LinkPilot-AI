import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { countEntries } from "@/services/myProfile/entries"
import { profileSearchState } from "@/services/myProfile/vectors"

export const dynamic = "force-dynamic"

/**
 * GET: How many entries each section of the asking person's My AI Profile holds, and how the whole
 * profile stands in search (how many parts can be found, and why any cannot). Their own only.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const [counts, search] = await Promise.all([countEntries(auth.viewer), profileSearchState(auth.viewer.id)])
    return NextResponse.json({ success: true, message: "Profile read", data: { counts, search } })
  } catch (error: unknown) {
    console.error("GET My AI Profile Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.loadFailed) }, { status: 500 })
  }
}

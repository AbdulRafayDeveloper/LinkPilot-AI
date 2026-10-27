import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"
import { catchUpSearch, profileSearchState } from "@/services/myProfile/vectors"

export const dynamic = "force-dynamic"
// Embedding a whole profile written before search existed can take a while the first time
export const maxDuration = 60

/**
 * POST: Saves for search whatever of the asking person's profile is not searchable yet (waiting,
 * failed, or written with another model), and answers how the profile stands now. Only what changed
 * is sent to Gemini, so calling it again when everything is ready costs nothing. Saves no entry.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    await runAiRequest(auth.viewer, "global-prompts", () => catchUpSearch(auth.viewer.id, req.signal))
    return NextResponse.json({ success: true, message: "Search updated", data: await profileSearchState(auth.viewer.id) })
  } catch (error: unknown) {
    console.error("POST My AI Profile index Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.loadFailed) }, { status: 500 })
  }
}

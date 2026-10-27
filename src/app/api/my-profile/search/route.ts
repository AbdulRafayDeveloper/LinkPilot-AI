import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ProfileSearchSchema } from "@/lib/validation/myProfile"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { isGeminiEmbeddingConfigured, missingGeminiConfiguration } from "@/services/embeddings/gemini"
import { runAiRequest } from "@/services/modelPriority"
import { searchMyProfile } from "@/services/myProfile/vectors"

export const dynamic = "force-dynamic"

/**
 * GET (?q=): The parts of the asking person's own profile closest in meaning to a question, closest
 * first, the way a tool will find them. Filtered to that person inside the database; saves nothing.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ProfileSearchSchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" })
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  if (!isGeminiEmbeddingConfigured()) {
    return NextResponse.json({ success: false, message: MY_PROFILE_MESSAGES.indexUnavailable(missingGeminiConfiguration().join(", ")) }, { status: 503 })
  }
  try {
    const { result } = await runAiRequest(auth.viewer, "global-prompts", () => searchMyProfile(auth.viewer.id, parsed.data.q, req.signal))
    return NextResponse.json({ success: true, message: "Searched", data: { matches: result } })
  } catch (error: unknown) {
    console.error("GET My AI Profile search Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.searchFailed) }, { status: 500 })
  }
}

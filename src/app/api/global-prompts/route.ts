import { SHARED_GLOBAL_PROMPT_IDS } from "@/constants/globalPrompts"
import { respondWithGlobalPrompts } from "@/lib/globalPromptRoutes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Every global prompt every account may change, Profile Info being the account's own. The
 * admin's own (Humanization) are at /api/admin/global-prompts and are never answered here.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  return respondWithGlobalPrompts(auth.viewer.id, SHARED_GLOBAL_PROMPT_IDS)
}

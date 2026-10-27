import { ADMIN_GLOBAL_PROMPT_IDS } from "@/constants/globalPrompts"
import { respondWithGlobalPrompts } from "@/lib/globalPromptRoutes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: Admin only. The latest saved text (or default) of the global prompts only an admin may change. */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  return respondWithGlobalPrompts(auth.viewer.id, ADMIN_GLOBAL_PROMPT_IDS)
}

import { NextRequest } from "next/server"
import { SHARED_GLOBAL_PROMPT_IDS } from "@/constants/globalPrompts"
import { saveGlobalPromptFrom } from "@/lib/globalPromptRoutes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * PUT: Saves one global prompt every account may change. The others are untouched, and a prompt
 * only an admin may change (Humanization) is unknown here, whoever asks: an admin saves it from
 * /api/admin/global-prompts.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  return saveGlobalPromptFrom(req, (await params).id, SHARED_GLOBAL_PROMPT_IDS)
}

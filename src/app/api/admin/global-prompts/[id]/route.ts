import { NextRequest } from "next/server"
import { ADMIN_GLOBAL_PROMPT_IDS } from "@/constants/globalPrompts"
import { saveGlobalPromptFrom } from "@/lib/globalPromptRoutes"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** PUT: Admin only. Saves one of the global prompts only an admin may change (Humanization). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  return saveGlobalPromptFrom(req, (await params).id, ADMIN_GLOBAL_PROMPT_IDS)
}

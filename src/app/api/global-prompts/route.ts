import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getGlobalPrompts } from "@/services/globalPrompts"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved text (or default) of every global prompt.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const prompts = await getGlobalPrompts()
    return NextResponse.json({ success: true, message: "Global prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Global Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the global prompts") },
      { status: 500 }
    )
  }
}

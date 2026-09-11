import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { getConnectionNotePrompts } from "@/services/connectionNote/prompts"

export const dynamic = "force-dynamic"

/**
 * GET: Returns the latest saved prompt (or default) for every connection note tone.
 */
export async function GET() {
  try {
    const prompts = await getConnectionNotePrompts()
    return NextResponse.json({ success: true, message: "Connection note prompts retrieved", data: prompts })
  } catch (error: unknown) {
    console.error("GET Connection Note Prompts Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, "Failed to load the connection note prompts") },
      { status: 500 }
    )
  }
}

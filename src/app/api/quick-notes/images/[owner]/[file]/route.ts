import { NextRequest, NextResponse } from "next/server"
import { QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import { noteImageLink } from "@/services/quickNotes/images"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ owner: string; file: string }> }

// A little under the signed link's own lifetime, so a cached redirect never points at an expired link
const REDIRECT_CACHE_SECONDS = 600

/**
 * GET: one image inside a note. The bucket is private, so this answers with a redirect to a freshly
 * signed link, for anyone allowed to see a note that shows it (services/quickNotes/images.ts).
 * Anything else, including a malformed path, is a 404 that says nothing more.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { owner, file } = await params
  const url = await noteImageLink(auth.viewer, { ownerId: owner, file }).catch((error: unknown) => {
    console.error("GET Quick Note Image Exception:", error instanceof Error ? error.message : error)
    return null
  })
  if (!url) return NextResponse.json({ success: false, message: QUICK_NOTES_MESSAGES.imageNotFound }, { status: 404 })
  const response = NextResponse.redirect(url, 302)
  response.headers.set("Cache-Control", `private, max-age=${REDIRECT_CACHE_SECONDS}`)
  return response
}

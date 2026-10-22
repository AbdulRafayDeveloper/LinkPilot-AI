import { NextRequest, NextResponse } from "next/server"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { accountPhotoLink } from "@/services/account/photo"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ owner: string; file: string }> }

// A little under the signed link's own lifetime, so a cached redirect never points at an expired one
const REDIRECT_CACHE_SECONDS = 600

/**
 * GET: an account's profile photo. The bucket is private, so this answers with a redirect to a
 * freshly signed link, and only for the account's own photo as it is now (services/account/photo.ts).
 * Anything else, including a malformed path or the name of a photo that has been replaced, is a 404
 * that says nothing more.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const { owner, file } = await params
  const url = await accountPhotoLink(auth.viewer, { ownerId: owner, file }).catch((error: unknown) => {
    console.error("GET Account Photo Exception:", error instanceof Error ? error.message : error)
    return null
  })
  if (!url) return NextResponse.json({ success: false, message: ACCOUNT_MESSAGES.photoNotFound }, { status: 404 })
  const response = NextResponse.redirect(url, 302)
  response.headers.set("Cache-Control", `private, max-age=${REDIRECT_CACHE_SECONDS}`)
  return response
}

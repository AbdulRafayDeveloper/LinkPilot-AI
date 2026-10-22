import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ACCOUNT_MESSAGES, ACCOUNT_PHOTO_MAX_BYTES } from "@/constants/account"
import { clearAccountPhoto, setAccountPhoto } from "@/services/account/photo"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST (the body is the image itself, at most 4 MB): stores this account's profile photo in place of
 * whatever it had and answers `{ photo }`, the path the page shows it by. The type is read from the
 * bytes, never from the browser, and the key is built on the server under this account's own folder.
 * A repeat simply stores the newer one, so a retried request is harmless.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > ACCOUNT_PHOTO_MAX_BYTES) {
    return NextResponse.json({ success: false, message: ACCOUNT_MESSAGES.photoTooLarge }, { status: 413 })
  }
  try {
    const bytes = Buffer.from(await req.arrayBuffer())
    const photo = await setAccountPhoto(auth.viewer, bytes)
    return NextResponse.json({ success: true, message: ACCOUNT_MESSAGES.photoSaved, data: { photo } }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Account Photo Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACCOUNT_MESSAGES.photoUploadFailed) }, { status: 400 })
  }
}

/** DELETE: takes the photo off, so the account shows its initials again. The file goes with it. */
export async function DELETE() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    await clearAccountPhoto(auth.viewer)
    return NextResponse.json({ success: true, message: ACCOUNT_MESSAGES.photoRemoved, data: { photo: null } })
  } catch (error: unknown) {
    console.error("DELETE Account Photo Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, ACCOUNT_MESSAGES.photoUploadFailed) }, { status: 400 })
  }
}

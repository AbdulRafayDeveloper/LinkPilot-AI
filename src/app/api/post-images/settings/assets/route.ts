import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { AssetUploadSchema } from "@/lib/validation/postImages"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { planAssetUpload } from "@/services/postImages/settings"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * POST: A signed link for one new brand photo. The browser sends the bytes straight to storage,
 * so the photo never passes through the app, and the photo joins the defaults only when the
 * settings are saved with it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = AssetUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || POST_IMAGES_MESSAGES.unsupportedAsset },
        { status: 400 }
      )
    }

    const plan = await planAssetUpload(auth.viewer, parsed.data.contentType, parsed.data.size)
    return NextResponse.json({ success: true, message: "Upload ready", data: plan }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST Post Image Asset Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, POST_IMAGES_MESSAGES.assetUploadFailed)
    const isRefused = [
      POST_IMAGES_MESSAGES.unsupportedAsset,
      POST_IMAGES_MESSAGES.assetTooLarge,
      POST_IMAGES_MESSAGES.tooManyAssets,
    ].includes(message as never)
    const isUnconfigured = message === POST_IMAGES_MESSAGES.storageUnavailable
    return NextResponse.json({ success: false, message }, { status: isRefused ? 400 : isUnconfigured ? 503 : 500 })
  }
}

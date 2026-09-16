import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BrandSettingsSchema } from "@/lib/validation/postImages"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"
import { getBrandSettings, saveBrandSettings } from "@/services/postImages/settings"

export const dynamic = "force-dynamic"

/**
 * GET: The saved brand defaults, with a fresh preview link for every photo.
 */
export async function GET() {
  try {
    const settings = await getBrandSettings()
    return NextResponse.json({ success: true, message: "Defaults retrieved", data: settings })
  } catch (error: unknown) {
    console.error("GET Post Image Settings Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, POST_IMAGES_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}

/**
 * PUT: Saves the defaults. A photo already saved is matched by its id and keeps its object; a
 * photo uploaded in this save carries the type and size it was uploaded with.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = BrandSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || POST_IMAGES_MESSAGES.badColor },
        { status: 400 }
      )
    }

    const uploads = new Map(
      parsed.data.assets
        .filter((asset) => asset.contentType && asset.size)
        .map((asset) => [asset.id, { contentType: asset.contentType as string, size: asset.size as number }])
    )
    const saved = await saveBrandSettings(
      { displayName: parsed.data.displayName, colors: parsed.data.colors, assets: parsed.data.assets },
      uploads
    )
    return NextResponse.json({ success: true, message: POST_IMAGES_MESSAGES.saved, data: saved })
  } catch (error: unknown) {
    console.error("PUT Post Image Settings Exception:", error instanceof Error ? error.message : error)
    const message = toUserFacingMessage(error, POST_IMAGES_MESSAGES.assetUploadFailed)
    const isRefused = [
      POST_IMAGES_MESSAGES.unsupportedAsset,
      POST_IMAGES_MESSAGES.assetTooLarge,
      POST_IMAGES_MESSAGES.tooManyAssets,
      POST_IMAGES_MESSAGES.assetGone,
    ].includes(message as never)
    return NextResponse.json({ success: false, message }, { status: isRefused ? 400 : 500 })
  }
}

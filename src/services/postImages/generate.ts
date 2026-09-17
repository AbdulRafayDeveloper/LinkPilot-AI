import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { generateImage } from "@/services/imageGeneration"
import { deleteObject, getObjectBytes, putObject } from "@/services/storage/s3"
import { PostImageModel, type IPostImage } from "@/models/PostImage"
import {
  POST_IMAGES_MESSAGES,
  getPoseLabel,
  imageSize,
  poseInstruction,
  type AssetPoseId,
  type ImageSizeId,
} from "@/constants/postImages"
import type { GenerateImageInput, PostImage } from "@/types/postImages"
import type { Viewer } from "@/types/auth"
import { findAsset, getStoredSettings } from "./settings"
import { getPostImagePrompt } from "./prompts"
import { toPostImage } from "./history"

/**
 * Making one post image.
 *
 * The instructions are built here rather than in the page: the fixed rules from post-image-system
 * wrap the user's own editable prompt, and the brand defaults, the post content and the chosen
 * pose are placed into it as runtime context. The finished text is what goes to the model and
 * what is kept on the record, so an image can always be read back against the words that made it.
 *
 * Nothing is written to the database until the image exists and is stored, so a failed
 * generation leaves no record to clean up and no image nobody can find.
 */

const IMAGE_PREFIX = "LinkPilot/post-images"

/** The colours the design may use, written the way a designer would read them. */
const describeColors = (colors: string[]) =>
  colors.length === 0 ? "No brand colours are set, so use a restrained neutral palette." : colors.join(", ")

interface GenerateOptions extends GenerateImageInput {
  viewer: Viewer
  signal: AbortSignal
}

/**
 * Builds the words the model draws from. Every part of the runtime context is placed by name, so
 * the editable prompt decides the wording and the app decides the facts.
 */
async function buildPrompt(options: {
  postContent: string
  displayName: string
  colors: string[]
  assetName: string | null
  pose: AssetPoseId | null
  size: ImageSizeId
}): Promise<string> {
  const { prompt: userPrompt } = await getPostImagePrompt()
  const shape = imageSize(options.size)
  const variables = {
    DISPLAY_NAME: options.displayName || "no name is set, so leave a name off the design",
    BRAND_COLORS: describeColors(options.colors),
    COLOR_COUNT: options.colors.length,
    POST_CONTENT: options.postContent.trim(),
    WIDTH: shape.width,
    HEIGHT: shape.height,
    ASPECT: shape.description,
    PERSON_BLOCK: options.assetName
      ? `A photograph of a real person is attached. ${poseInstruction(options.pose ?? "standing")}`
      : "No photograph is attached. There must be no person in this image at all. No face, no portrait, no silhouette, no figure, no hands, no crowd, not even in the background. Design a graphic composition only, made of shapes, type and space.",
    POSE: options.pose ? getPoseLabel(options.pose) : "no photograph",
  }
  const system = renderPrompt(await loadPrompt("post-image-system"), variables)
  const brief = renderPrompt(userPrompt, {
    ...variables,
    display_name: String(variables.DISPLAY_NAME),
    brand_colors: String(variables.BRAND_COLORS),
    post_content: variables.POST_CONTENT,
    person: String(variables.PERSON_BLOCK),
    aspect: String(variables.ASPECT),
  })
  return `${system}\n\n${brief}`.trim()
}

/**
 * Draws one image, stores it, and writes the record that describes how it was made. The record
 * copies the settings in rather than pointing at them, so changing the defaults afterwards never
 * changes what an older image says about itself.
 */
export async function createPostImage({ viewer, postContent, assetId, pose, size, signal }: GenerateOptions): Promise<PostImage> {
  const settings = await getStoredSettings(viewer)
  const asset = assetId ? await findAsset(viewer, assetId) : null
  if (assetId && !asset) throw new UserFacingError(POST_IMAGES_MESSAGES.notFound)

  const colors = settings?.colors ?? []
  const displayName = settings?.displayName ?? ""
  const prompt = await buildPrompt({
    postContent,
    displayName,
    colors,
    assetName: asset?.name ?? null,
    pose: asset ? pose : null,
    size,
  })

  // The photo is read back from storage here, so the browser never has to send it again
  // Read through the SDK, which retries a failed read, rather than fetching a signed link once
  const photoBytes = asset ? await getObjectBytes(asset.storageKey, signal) : null
  if (asset && !photoBytes) throw new UserFacingError(POST_IMAGES_MESSAGES.assetUploadFailed)
  const photo =
    asset && photoBytes
      ? { data: photoBytes, contentType: asset.contentType, fileName: `${asset.id}.${asset.contentType.split("/")[1] || "png"}` }
      : null

  const shape = imageSize(size)
  const started = Date.now()
  const image = await generateImage({ prompt, size: shape.value, photo, signal })

  const id = new mongoose.Types.ObjectId()
  const storageKey = `${IMAGE_PREFIX}/${id.toString()}.png`
  await putObject(storageKey, image.data, image.contentType)

  try {
    await connectDatabase()
    const record = (await PostImageModel.create({
      _id: id,
      ownerId: viewer.id,
      storageKey,
      contentType: image.contentType,
      size: image.data.length,
      width: shape.width,
      height: shape.height,
      postContent: postContent.trim(),
      displayName,
      colors,
      assetName: asset?.name ?? null,
      assetStorageKey: asset?.storageKey ?? null,
      pose: asset ? pose : null,
      sizeId: size,
      model: image.model,
      prompt,
    })) as unknown as IPostImage & { _id: mongoose.Types.ObjectId }

    console.info(
      "Post image created:",
      JSON.stringify({
        model: image.model,
        size: shape.value,
        withPhoto: Boolean(asset),
        pose: asset ? pose : null,
        colors: colors.length,
        bytes: image.data.length,
        seconds: Math.round((Date.now() - started) / 1000),
      })
    )
    return toPostImage(record)
  } catch (error: unknown) {
    // The record is what makes the image findable, so an image without one is taken back out
    await deleteObject(storageKey).catch(() => undefined)
    throw error
  }
}

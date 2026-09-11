import { z } from "zod"
import { detectImageMimeType, type VerifiedImage } from "@/lib/imageType"
import { POST_IMAGE_MAX_BYTES, POST_INPUT_MESSAGES, POST_TEXT_MAX_LENGTH } from "@/constants/postInput"

export type PostSource = { type: "text"; text: string } | { type: "image"; image: VerifiedImage }

export type PostInputResult = { post: PostSource | null } | { error: string }

interface PostInputOptions {
  required: boolean
  missingMessage: string
}

const PostFieldsSchema = z.object({
  // An unknown mode counts as no post rather than an error of its own
  inputMode: z.enum(["text", "image"]).optional().catch(undefined),
  postText: z.string().trim().max(POST_TEXT_MAX_LENGTH, POST_INPUT_MESSAGES.postTooLong).optional(),
  image: z
    .instanceof(Blob)
    .refine((file) => file.size <= POST_IMAGE_MAX_BYTES, POST_INPUT_MESSAGES.imageTooLarge)
    .optional(),
})

/**
 * Reads the post fields of a multipart form (inputMode, postText, image). Only the selected
 * mode's field is used. An image's type is decided by its own bytes, never by the client's
 * MIME type. Returns { post: null } for an optional post that was left empty.
 */
export async function parsePostInput(form: FormData, { required, missingMessage }: PostInputOptions): Promise<PostInputResult> {
  const fields = PostFieldsSchema.safeParse({
    inputMode: form.get("inputMode") ?? undefined,
    postText: form.get("postText") ?? undefined,
    image: form.get("image") ?? undefined,
  })
  if (!fields.success) return { error: fields.error.issues[0]?.message || missingMessage }

  const { inputMode, postText, image } = fields.data
  if (inputMode === "text" && postText) return { post: { type: "text", text: postText } }
  if (inputMode === "image" && image && image.size > 0) {
    const data = Buffer.from(await image.arrayBuffer())
    const mimeType = detectImageMimeType(data)
    return mimeType ? { post: { type: "image", image: { data, mimeType } } } : { error: POST_INPUT_MESSAGES.unsupportedImage }
  }
  return required ? { error: missingMessage } : { post: null }
}

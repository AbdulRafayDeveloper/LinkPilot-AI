import OpenAI, { toFile } from "openai"
import { env } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { withProviderRetry } from "@/services/ai"
import { POST_IMAGES_MESSAGES } from "@/constants/postImages"

/**
 * Drawing pictures, through the OpenAI Images API.
 *
 * The chat models in services/ai.ts write words; this is the one place that asks for an image.
 * The model name comes from OPENAI_IMAGE_MODEL and is never written into the code, the key stays
 * on the server, and the bytes come back in the answer rather than from a URL that would expire.
 *
 * When a photo is supplied, the request goes to the edit endpoint with that photo attached,
 * which is what keeps the person in it recognisable. `input_fidelity: high` makes that much
 * stronger and only some models take it, so a model that refuses the parameter is simply asked
 * again without it rather than failing the request.
 */

// Drawing takes longer than writing, and the answer carries the whole image
const IMAGE_TIMEOUT_MS = 120_000

let client: OpenAI | null = null

export function isImageModelConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_IMAGE_MODEL)
}

/** The model this app draws with, from the environment. */
export function imageModelName(): string {
  if (!isImageModelConfigured()) throw new UserFacingError(POST_IMAGES_MESSAGES.modelUnavailable)
  return env.OPENAI_IMAGE_MODEL as string
}

function images(): OpenAI {
  if (!isImageModelConfigured()) throw new UserFacingError(POST_IMAGES_MESSAGES.modelUnavailable)
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY as string, timeout: IMAGE_TIMEOUT_MS, maxRetries: 0 })
  return client
}

export interface SourcePhoto {
  data: Buffer
  contentType: string
  fileName: string
}

export interface ImageRequest {
  prompt: string
  // "1024x1024", "1024x1536" or "1536x1024"
  size: string
  // The photo whose person must stay recognisable, when there is one
  photo?: SourcePhoto | null
  signal: AbortSignal
}

export interface GeneratedImage {
  data: Buffer
  contentType: string
  model: string
}

// The provider says so in the message when a parameter is not supported by the chosen model
const unsupportedParameter = (error: unknown, name: string) =>
  error instanceof Error && error.message.includes(name)

/**
 * Asks the model for one image and hands back the bytes. A refusal from the provider is the
 * user's to act on, so it is passed through as its own message rather than as a server error.
 */
export async function generateImage({ prompt, size, photo, signal }: ImageRequest): Promise<GeneratedImage> {
  const model = imageModelName()
  const client = images()

  const draw = async (withFidelity: boolean) => {
    if (!photo) {
      return client.images.generate({ model, prompt, size: size as "1024x1024", n: 1 }, { signal })
    }
    return client.images.edit(
      {
        model,
        image: await toFile(photo.data, photo.fileName, { type: photo.contentType }),
        prompt,
        size: size as "1024x1024",
        n: 1,
        // Only some models take this, and it is what keeps a supplied face recognisable
        ...(withFidelity ? { input_fidelity: "high" as const } : {}),
      },
      { signal }
    )
  }

  const answer = await withProviderRetry(
    "openai",
    async () => {
      try {
        return await draw(Boolean(photo))
      } catch (error: unknown) {
        // A model that does not take input_fidelity still draws the image without it
        if (photo && unsupportedParameter(error, "input_fidelity")) return await draw(false)
        throw error
      }
    },
    signal,
    1
  ).catch((error: unknown) => {
    if (signal.aborted) throw error
    const status = (error as { status?: number }).status
    console.error("❌ Image generation failed:", status ?? "", error instanceof Error ? error.message : error)
    // 400 from the images API is the provider refusing the request, not a fault in the app
    throw new UserFacingError(status === 400 ? POST_IMAGES_MESSAGES.refused : POST_IMAGES_MESSAGES.generationFailed)
  })

  const encoded = answer.data?.[0]?.b64_json
  if (!encoded) throw new UserFacingError(POST_IMAGES_MESSAGES.generationFailed)
  return { data: Buffer.from(encoded, "base64"), contentType: "image/png", model }
}

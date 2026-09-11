import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { AI_PROVIDERS, generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { UserFacingError } from "@/lib/errors"
import type { VerifiedImage } from "@/lib/imageType"
import { POST_INPUT_MESSAGES } from "@/constants/postInput"

// Transcription should be literal, not creative
const EXTRACTION_TEMPERATURE = 0
const MIN_POST_TEXT_LENGTH = 15
// Gemini reads the screenshot first; OpenAI vision is only the fallback
const DEFAULT_PROVIDERS: readonly ModelProvider[] = AI_PROVIDERS

const PostTranscriptionSchema = z.object({
  contains_post: z.boolean().describe("True only if the image shows a readable social media post"),
  author: z.string().describe("The post author's name as shown, or an empty string"),
  post_text: z.string().describe("The post's full visible text, transcribed exactly"),
})

interface ExtractionOptions {
  image: VerifiedImage
  signal: AbortSignal
  providers?: readonly ModelProvider[]
  onFallback?: () => void
}

/**
 * Reads a LinkedIn post from a screenshot with the vision-capable writing models through
 * LangChain, so every later step works from plain post text. Throws a user-facing error
 * when the image doesn't show a readable post.
 */
export async function extractPostFromImage({
  image,
  signal,
  providers = DEFAULT_PROVIDERS,
  onFallback,
}: ExtractionOptions): Promise<{ postText: string; provider: ModelProvider }> {
  const { data, provider } = await generateStructuredWithFallback({
    schema: PostTranscriptionSchema,
    name: "linkedin_post_transcription",
    messages: [
      new SystemMessage(loadPrompt("post-image-extraction")),
      new HumanMessage({
        content: [
          { type: "text", text: "Transcribe the LinkedIn post in this screenshot." },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data.toString("base64")}` } },
        ],
      }),
    ],
    temperature: EXTRACTION_TEMPERATURE,
    providers,
    signal,
    onFallback,
    validate: (output) => (output.contains_post && !output.post_text.trim() ? "post detected but no text transcribed" : null),
  })

  const postText = data.post_text.trim()
  // "No post" is a valid answer about the image, not a provider failure, so it isn't retried
  if (!data.contains_post || postText.length < MIN_POST_TEXT_LENGTH) {
    throw new UserFacingError(POST_INPUT_MESSAGES.unreadableImage)
  }
  const author = data.author.trim()
  return { postText: author ? `Author: ${author}\n\n${postText}` : postText, provider }
}

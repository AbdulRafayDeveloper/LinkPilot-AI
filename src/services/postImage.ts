import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { currentModelOrder } from "@/lib/modelOrder"
import { loadPrompt, type PromptName } from "@/services/prompts"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { UserFacingError } from "@/lib/errors"
import type { VerifiedImage } from "@/lib/imageType"
import { POST_INPUT_MESSAGES } from "@/constants/postInput"
import type { FallbackNotice } from "@/constants/aiProviders"

// Transcription should be literal, not creative
const EXTRACTION_TEMPERATURE = 0
const MIN_POST_TEXT_LENGTH = 15

/**
 * Each tool that reads a screenshot has its own rules prompt and reads the request and the fields'
 * wording from its own instructions prompt, so an admin can change how one tool reads a screenshot
 * without changing the other. They started as copies of one shared prompt (`post-image-extraction`).
 */
const SCREENSHOT_PROMPTS = {
  "comment-writer": { system: "comment-writer-post-image-extraction", book: "comment-writer-instructions" },
  "post-comment-replies": { system: "post-comment-reply-post-image-extraction", book: "post-comment-reply-instructions" },
} as const satisfies Record<string, { system: PromptName; book: PromptName }>

export type ScreenshotTool = keyof typeof SCREENSHOT_PROMPTS

const postTranscriptionSchema = (book: PromptBook) =>
  z.object({
    contains_post: z.boolean().describe(book.text("screenshot.field.contains-post")),
    author: z.string().describe(book.text("screenshot.field.author")),
    post_text: z.string().describe(book.text("screenshot.field.post-text")),
  })

interface ExtractionOptions {
  // Which tool is reading it, which decides the rules prompt and the wording read
  tool: ScreenshotTool
  image: VerifiedImage
  signal: AbortSignal
  // Defaults to the request's order; only providers with a vision model are tried
  providers?: readonly ModelProvider[]
  onFallback?: FallbackNotice
}

/**
 * Reads a LinkedIn post from a screenshot with the vision-capable writing models through
 * LangChain, so every later step works from plain post text. Throws a user-facing error
 * when the image doesn't show a readable post.
 */
export async function extractPostFromImage({
  tool,
  image,
  signal,
  providers = currentModelOrder(),
  onFallback,
}: ExtractionOptions): Promise<{ postText: string; provider: ModelProvider }> {
  const prompts = SCREENSHOT_PROMPTS[tool]
  const [book, system] = await Promise.all([loadPromptBook(prompts.book), loadPrompt(prompts.system)])
  const { data, provider } = await generateStructuredWithFallback({
    schema: postTranscriptionSchema(book),
    name: "linkedin_post_transcription",
    messages: [
      new SystemMessage(system),
      new HumanMessage({
        content: [
          { type: "text", text: book.text("screenshot.request") },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data.toString("base64")}` } },
        ],
      }),
    ],
    temperature: EXTRACTION_TEMPERATURE,
    providers,
    input: "image",
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
  return { postText: author ? `${book.text("screenshot.author", { author })}\n\n${postText}` : postText, provider }
}

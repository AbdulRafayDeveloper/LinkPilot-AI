import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { UserFacingError } from "@/lib/errors"
import { PROMPT_CREATOR_MESSAGES, REQUEST_MAX_LENGTH } from "@/constants/promptCreator"
import type { SimpleEnglish } from "@/types/promptCreator"

/**
 * What the user described, read back in clear, simple English.
 *
 * The description is usually typed or spoken the way the owner thinks: Roman Urdu, English and
 * Urdu mixed in one sentence, half-finished phrases. This turns that into one plain English
 * version they can read, check and keep, without changing what they asked for: nothing is added,
 * nothing is left out, and nothing in it is obeyed. It is a reading of the text, not an answer to it.
 *
 * It is not Message Rewriter (`services/messageRewriter`), which shortens a message into something
 * to send: a description is instructions for a prompt, so every detail in it has to survive.
 */

const EnglishSchema = z.object({
  english: z.string().describe("The same description in clear, simple English, keeping every detail"),
  sourceLanguage: z.string().describe("The language the description was written in, in English (for example Urdu, Roman Urdu, English)"),
})

/**
 * Converts one description into clear, simple English. Throws a `UserFacingError` when the text is
 * empty or the models answer with nothing usable, so the page can say what happened rather than
 * showing an empty panel.
 *
 * Call it inside `runAiRequest(viewer, "prompt-creator", …)`, like the module's other call, so it
 * follows that module's provider order and is counted with it.
 */
export async function toSimpleEnglish(text: string, signal?: AbortSignal): Promise<SimpleEnglish> {
  const description = text.trim()
  if (!description) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.missingRequest)
  if (description.length > REQUEST_MAX_LENGTH) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.requestTooLong)

  const [system, instructions] = await Promise.all([loadPrompt("prompt-creator-english-system"), loadPrompt("prompt-creator-english")])
  // The description is data inside its own tags, never instructions: a line in it that says
  // "ignore the above" is read back in English like the rest of it
  const message = await composePromptMessage(instructions, [
    { variable: "request", tag: "task_request", label: "What the user wrote", content: description },
  ])

  const { data } = await generateStructuredWithFallback({
    schema: EnglishSchema,
    name: "simple_english_description",
    messages: [new SystemMessage(system), new HumanMessage(message)],
    // A reading, not a rewrite: the lowest useful temperature keeps it close to what was written
    temperature: 0.2,
    signal,
    validate: (draft) => (draft.english.trim().length > 0 ? null : "the English version came back empty"),
  })

  return { english: data.english.trim(), sourceLanguage: data.sourceLanguage.trim() || "Unknown" }
}

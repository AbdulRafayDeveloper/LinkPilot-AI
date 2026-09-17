import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { UserFacingError } from "@/lib/errors"
import {
  CREATED_NAME_MAX_LENGTH,
  CREATED_PROMPT_MAX_LENGTH,
  PROMPT_CREATOR_MESSAGES,
  getPromptTargetLabel,
  type PromptTargetId,
} from "@/constants/promptCreator"
import type { RequestSource } from "@/types/promptCreator"
import { getActiveTargetPrompt } from "./prompts"

// Prompts are instructions, not creative writing: low temperature keeps them precise
const WRITING_TEMPERATURE = 0.4
const MIN_PROMPT_LENGTH = 40
const NAME_WORDS = { min: 3, max: 6 }

/**
 * The name comes first on purpose: the model settles what the prompt is about before it
 * writes the prompt itself.
 */
const CreatedPromptSchema = z.object({
  name: z.string().describe("A 4-5 word title for this prompt, in plain words, no quotes and no file extension"),
  prompt: z
    .string()
    .describe("The complete, ready-to-paste prompt in clear English, written to the AI that will carry out the task"),
})

type CreatedPromptOutput = z.infer<typeof CreatedPromptSchema>

interface GenerateOptions {
  request: string
  target: PromptTargetId
  requestSource: RequestSource
  signal: AbortSignal
}

export interface GeneratedPrompt {
  name: string
  prompt: string
  target: PromptTargetId
  provider: ModelProvider
}

// Models like to wrap a prompt in a code fence or introduce it; the prompt itself is what we keep
function cleanPrompt(text: string): string {
  const fenced = text.trim().match(/^```[a-z]*\r?\n([\s\S]*?)\r?\n?```$/i)
  return (fenced ? fenced[1] : text).trim()
}

// A title, not a sentence: no quotes, no trailing full stop, a handful of words
function cleanName(text: string): string {
  const name = text
    .replace(/[`"'*#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:;,\s]+$/, "")
    .trim()
  return name.split(" ").slice(0, NAME_WORDS.max).join(" ").slice(0, CREATED_NAME_MAX_LENGTH)
}

function findUnusableReason(output: CreatedPromptOutput): string | null {
  const prompt = cleanPrompt(output.prompt)
  const name = cleanName(output.name)
  if (prompt.length < MIN_PROMPT_LENGTH) return "the prompt is too short to be usable"
  if (prompt.length > CREATED_PROMPT_MAX_LENGTH) return "the prompt is far longer than a prompt should be"
  if (!name) return "empty name"
  if (name.split(" ").length < NAME_WORDS.min) return "the name is not a few words"
  return null
}

/**
 * Writes one ready-to-paste prompt from what the user described, using the latest saved prompt
 * for the chosen target, in the module's provider order (Groq first). The description is untrusted text inside its own delimiter tags, so it
 * is treated as the subject of the work and never as instructions to follow.
 */
export async function createPrompt({ request, target, requestSource, signal }: GenerateOptions): Promise<GeneratedPrompt> {
  const targetPrompt = await getActiveTargetPrompt(target)
  const system = renderPrompt(await loadPrompt("prompt-creator-system"), {
    TARGET: getPromptTargetLabel(target),
    MAX_CHARS: CREATED_PROMPT_MAX_LENGTH,
  })
  const user = composePromptMessage(
    targetPrompt,
    [
      {
        variable: "request",
        tag: "task_request",
        label: "What the user wants done",
        content: request,
      },
    ],
    { target: getPromptTargetLabel(target) }
  )

  const { data, provider } = await generateStructuredWithFallback({
    schema: CreatedPromptSchema,
    name: "created_prompt",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  })

  const prompt = cleanPrompt(data.prompt)
  const name = cleanName(data.name)
  if (!prompt || !name) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.generationFailed)

  console.info(
    "Prompt created:",
    JSON.stringify({ target, provider, requestSource, requestCharacters: request.length, promptCharacters: prompt.length })
  )
  return { name, prompt, target, provider }
}

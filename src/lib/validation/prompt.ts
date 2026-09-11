import { z } from "zod"
import { PROMPT_MAX_LENGTH, PROMPT_MIN_LENGTH } from "@/constants/prompts"

export const PromptUpdateSchema = z.object({
  prompt: z
    .string({ error: "Prompt is required" })
    .trim()
    .min(PROMPT_MIN_LENGTH, `Prompt must be at least ${PROMPT_MIN_LENGTH} characters long`)
    .max(PROMPT_MAX_LENGTH, `Prompt must be under ${PROMPT_MAX_LENGTH.toLocaleString()} characters`),
})

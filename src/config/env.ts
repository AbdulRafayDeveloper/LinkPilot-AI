import { z } from "zod"

/**
 * Server-side configuration and the single source of truth for AI models: no model name
 * is hardcoded anywhere else. Gemini is the primary provider and OpenAI (GPT-4o Mini) the
 * fallback; each is used only when both its API key and its model name are set.
 */
const envSchema = z.object({
  MONGODB_URI: z.string().default("mongodb://localhost:27017/linkpilot_ai"),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_LIGHTWEIGHT_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_LIGHTWEIGHT_MODEL: z.string().optional(),
})

function readEnv() {
  const values = Object.fromEntries(
    Object.keys(envSchema.shape).map((key) => [key, process.env[key]?.trim() || undefined])
  )
  return envSchema.parse(values)
}

export const env = readEnv()

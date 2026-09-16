import { z } from "zod"

/**
 * Server-side configuration and the single source of truth for every URL, secret and AI
 * model name: none of them is hardcoded anywhere else, and none has a fallback value.
 * Gemini is the primary provider and OpenAI the fallback; each is used only when both its
 * API key and its model name are set. Import this module from server code only.
 */
const envSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }),
  MONGODB_URI: z.string({ error: "is required" }),
  // Unlocks every Update Prompt editor; when unset, prompt editing stays locked for everyone
  PROMPT_EDITOR_PASSWORD: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_LIGHTWEIGHT_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_LIGHTWEIGHT_MODEL: z.string().optional(),
  // Reads recordings when Gemini cannot (Prompt Creator voice input); OpenAI's transcription model
  OPENAI_TRANSCRIPTION_MODEL: z.string().optional(),
  // The X (Twitter) account for twitter:site and twitter:creator; left out of the cards when unset
  TWITTER_HANDLE: z
    .string()
    .regex(/^@\w{1,15}$/, { error: 'must look like "@handle"' })
    .optional(),
})

function readEnv() {
  const values = Object.fromEntries(
    Object.keys(envSchema.shape).map((key) => [key, process.env[key]?.trim() || undefined])
  )
  const parsed = envSchema.safeParse(values)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`)
    throw new Error(`Invalid environment configuration (see .env.example): ${problems.join("; ")}`)
  }
  return parsed.data
}

export const env = readEnv()

// The public site origin without a trailing slash, for canonical links, the sitemap and JSON-LD
export const SITE_URL = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "")

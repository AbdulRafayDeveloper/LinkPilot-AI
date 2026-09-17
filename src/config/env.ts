import { z } from "zod"

/**
 * Server-side configuration and the single source of truth for every URL, secret and AI
 * model name: none of them is hardcoded anywhere else, and none has a fallback value.
 * Groq is the first provider for every module, then an optional open-source model on any
 * OpenAI-compatible server, then OpenAI; each is used only when what it needs is set, and an admin can
 * change the order per module (services/modelPriority.ts). Import this module from server code only.
 */
const envSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }),
  MONGODB_URI: z.string({ error: "is required" }),
  // Signs every session cookie. A long random value; changing it signs everyone out
  AUTH_SECRET: z.string({ error: "is required" }).min(32, { error: "must be at least 32 characters" }),
  // "true" lets anyone create a user account at /signup; anything else leaves accounts to the scripts in scripts/
  ALLOW_SIGNUP: z.enum(["true", "false"], { error: 'must be "true" or "false"' }).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_LIGHTWEIGHT_MODEL: z.string().optional(),
  // Reads recordings when Groq cannot (voice input); OpenAI's transcription model
  OPENAI_TRANSCRIPTION_MODEL: z.string().optional(),
  // Turns text into vectors for the meeting chat (e.g. text-embedding-3-small). Groq has no embedding
  // model, so this is OpenAI's; without it a meeting cannot be asked questions
  OPENAI_EMBEDDING_MODEL: z.string().optional(),
  // Groq, the first provider everywhere. Up to five API keys, tried in order: a key that is rejected or
  // rate limited hands the call to the next one (services/ai.ts withGroqKey)
  GROQ_API_KEY_1: z.string().optional(),
  GROQ_API_KEY_2: z.string().optional(),
  GROQ_API_KEY_3: z.string().optional(),
  GROQ_API_KEY_4: z.string().optional(),
  GROQ_API_KEY_5: z.string().optional(),
  // Writes every text and runs live web research (Groq's browser search), e.g. openai/gpt-oss-120b
  GROQ_MODEL: z.string().optional(),
  // Reads screenshots, e.g. qwen/qwen3.8-27b; without it screenshots go to the next provider
  GROQ_VISION_MODEL: z.string().optional(),
  // Reads speech (Whisper on Groq), e.g. whisper-large-v3-turbo
  GROQ_TRANSCRIPTION_MODEL: z.string().optional(),
  // An open-source model on any OpenAI-compatible server (Ollama, LM Studio, vLLM), the fallback once every
  // Groq key is used up. Needs the base URL and the model; the key only when the server asks for one
  OPEN_SOURCE_BASE_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }).optional(),
  OPEN_SOURCE_MODEL: z.string().optional(),
  OPEN_SOURCE_API_KEY: z.string().optional(),
  // The image model that draws post images (OpenAI Images), e.g. gpt-image-1. Without it the
  // Post Image Creator says so and every other module carries on
  OPENAI_IMAGE_MODEL: z.string().optional(),
  // S3 storage for Important Files and Post Image Creator. All four are needed before anything can be stored, and the
  // module says so rather than the app refusing to start without them
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
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

// The Groq keys that are set, in the order they are tried
export const GROQ_API_KEYS = [env.GROQ_API_KEY_1, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3, env.GROQ_API_KEY_4, env.GROQ_API_KEY_5].filter(
  (key): key is string => Boolean(key)
)

// The public site origin without a trailing slash, for canonical links, the sitemap and JSON-LD
export const SITE_URL = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "")

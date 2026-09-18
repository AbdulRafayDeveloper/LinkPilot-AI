import { NextResponse } from "next/server"
import {
  AI_PROVIDERS,
  isGroqTranscriptionConfigured,
  isProviderConfigured,
  isTranscriptionConfigured,
  missingConfiguration,
  providerNames,
} from "@/services/ai"
import { GROQ_API_KEYS } from "@/config/env"
import { activeGroqKeyNumber } from "@/services/groqKeyState"
import { isImageModelConfigured } from "@/services/imageGeneration"
import { isStorageConfigured } from "@/services/storage/s3"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: What this deployment is actually configured to do.
 *
 * A generation that fails on a host and works on a laptop is nearly always a variable that never
 * made it to the host, so this says which ones are set and which are missing. It answers with
 * names and yes or no only. No value, no key, no fragment of one, ever leaves here.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const providers = AI_PROVIDERS.map((provider) => {
    const { label, keyVariable, modelVariable } = providerNames(provider)
    return {
      provider,
      label,
      configured: isProviderConfigured(provider),
      variables: [keyVariable, modelVariable],
    }
  })

  return NextResponse.json({
    success: true,
    message: "Configuration checked",
    data: {
      // Every module writes with the first of these that is configured
      canGenerate: AI_PROVIDERS.some((provider) => isProviderConfigured(provider)),
      providers,
      // What each unconfigured provider is waiting for, in words
      missing: missingConfiguration(),
      features: {
        // Voice input on Prompt Creator, Client Messaging and Client Voices
        transcription: isTranscriptionConfigured() || isGroqTranscriptionConfigured(),
        // Speech is read with Whisper on Groq first
        groqTranscription: isGroqTranscriptionConfigured(),
        // Screenshots (Comment Writer, Post Comment Replies): a vision model on Groq, or OpenAI
        screenshots: isProviderConfigured("groq", "image") || isProviderConfigured("openai", "image"),
        // How many Groq keys are set, never which
        groqKeys: GROQ_API_KEYS.length,
        // The number of the Groq key calls start from now (GROQ_API_KEY_<n>), never its value
        groqActiveKey: await activeGroqKeyNumber(),
        // Post Image Creator
        imageGeneration: isImageModelConfigured(),
        // Important Files and Post Image Creator
        fileStorage: isStorageConfigured(),
      },
    },
  })
}

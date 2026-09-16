import { NextResponse } from "next/server"
import {
  AI_PROVIDERS,
  isProviderConfigured,
  isTranscriptionConfigured,
  missingConfiguration,
  providerNames,
} from "@/services/ai"
import { isImageModelConfigured } from "@/services/imageGeneration"
import { isStorageConfigured } from "@/services/storage/s3"

export const dynamic = "force-dynamic"

/**
 * GET: What this deployment is actually configured to do.
 *
 * A generation that fails on a host and works on a laptop is nearly always a variable that never
 * made it to the host, so this says which ones are set and which are missing. It answers with
 * names and yes or no only. No value, no key, no fragment of one, ever leaves here.
 */
export async function GET() {
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
      // Writing anything at all needs at least one of these
      canGenerate: providers.some((entry) => entry.configured),
      providers,
      // What each unconfigured provider is waiting for, in words
      missing: missingConfiguration(),
      features: {
        // Voice input on Prompt Creator, Client Messaging and Client Voices
        transcription: isProviderConfigured("gemini") || isTranscriptionConfigured(),
        // Post Image Creator
        imageGeneration: isImageModelConfigured(),
        // Important Files and Post Image Creator
        fileStorage: isStorageConfigured(),
      },
    },
  })
}

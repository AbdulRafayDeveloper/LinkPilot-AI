import {
  isGroqTranscriptionConfigured,
  isTranscriptionConfigured,
  transcribeWithGroq,
  transcribeWithOpenAI,
} from "@/services/ai"
import { UserFacingError } from "@/lib/errors"
import { currentModelOrder } from "@/lib/modelOrder"
import { describeProviderFailure, type ProviderNames } from "@/lib/providerErrors"
import type { VerifiedAudio } from "@/lib/audioType"
import { VOICE_MESSAGES, type TranscriptionProvider } from "@/constants/voiceInput"

const MIN_TRANSCRIPT_LENGTH = 3

interface TranscribeOptions {
  audio: VerifiedAudio
  signal: AbortSignal
  // The providers to try, in order; defaults to the request's order (lib/modelOrder.ts), Groq first
  providers?: readonly string[]
}

export interface Transcript {
  text: string
  // Who wrote it out, so the page can say so
  provider: TranscriptionProvider
}

interface Reader {
  isConfigured: () => boolean
  // Null means it heard no speech at all, so the next provider listens too
  read: (audio: VerifiedAudio, signal: AbortSignal) => Promise<string | null>
  // What to name in a failure: the provider and the variables to check
  names: ProviderNames
}

const isTranscriptionProvider = (provider: string): provider is TranscriptionProvider => provider === "groq" || provider === "openai"

const READERS: Record<TranscriptionProvider, Reader> = {
  groq: {
    isConfigured: isGroqTranscriptionConfigured,
    read: transcribeWithGroq,
    names: { label: "Groq transcription", keyVariable: "GROQ_API_KEY_1 to GROQ_API_KEY_5", modelVariable: "GROQ_TRANSCRIPTION_MODEL" },
  },
  openai: {
    isConfigured: isTranscriptionConfigured,
    read: transcribeWithOpenAI,
    names: { label: "OpenAI transcription", keyVariable: "OPENAI_API_KEY", modelVariable: "OPENAI_TRANSCRIPTION_MODEL" },
  },
}

/**
 * Turns a recording into text, trying the module's providers in order (by default Whisper on Groq, every
 * key, then OpenAI's transcription model; the open-source model can't read speech, so it is skipped).
 * A provider that is unconfigured is skipped, one that fails hands the same
 * recording to the next, and the answer says which provider wrote it out. Whatever comes back is
 * only the words that were said; the rest of the module works from that plain text.
 */
export async function transcribeRecording({ audio, signal, providers = currentModelOrder() }: TranscribeOptions): Promise<Transcript> {
  const usable = providers.filter(isTranscriptionProvider).filter((provider) => READERS[provider].isConfigured())
  if (usable.length === 0) throw new UserFacingError(VOICE_MESSAGES.voiceUnavailable)

  // Why each provider gave up, so a failure names what to change
  const failures: string[] = []
  for (const [index, provider] of usable.entries()) {
    let text: string | null
    try {
      text = await READERS[provider].read(audio, signal)
    } catch (error: unknown) {
      if (signal.aborted) throw error
      const next = usable[index + 1]
      console.warn(`⚠️ ${provider} could not read the recording${next ? `, falling back to ${next}` : ""}:`, error instanceof Error ? error.message : error)
      failures.push(describeProviderFailure(error, READERS[provider].names))
      continue
    }
    // Nobody spoke, as far as this provider could tell, so the next one listens too
    if (text === null) continue

    const written = text.trim()
    // "Nothing was said" is a valid answer about the recording, not a provider failure
    if (written.length < MIN_TRANSCRIPT_LENGTH) throw new UserFacingError(VOICE_MESSAGES.unclearAudio)
    return { text: written, provider }
  }

  // Every provider that answered heard no speech; one that failed says what went wrong instead
  if (failures.length === 0) throw new UserFacingError(VOICE_MESSAGES.unclearAudio)
  console.error("❌ No provider could read the recording:", failures.join(" "))
  throw new UserFacingError(failures.join(" "))
}

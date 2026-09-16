import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import {
  generateStructuredWithFallback,
  isProviderConfigured,
  isTranscriptionConfigured,
  transcribeWithOpenAI,
} from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { UserFacingError } from "@/lib/errors"
import type { VerifiedAudio } from "@/lib/audioType"
import { PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"

// A transcript must be literal, never invented
const TRANSCRIPTION_TEMPERATURE = 0
// Sending and reading a few minutes of audio takes longer than a text generation
const TRANSCRIPTION_TIMEOUT_MS = 100_000
const MIN_TRANSCRIPT_LENGTH = 3

const TranscriptSchema = z.object({
  contains_speech: z.boolean().describe("True only if the recording contains audible speech"),
  transcript: z.string().describe("Everything that was said, written out in the language it was spoken"),
})

interface TranscribeOptions {
  audio: VerifiedAudio
  signal: AbortSignal
}

// Gemini reads the recording inside the chat model, the way screenshots are read
async function readWithGemini(audio: VerifiedAudio, signal: AbortSignal): Promise<string | null> {
  const { data } = await generateStructuredWithFallback({
    schema: TranscriptSchema,
    name: "spoken_request_transcript",
    messages: [
      new SystemMessage(await loadPrompt("prompt-creator-transcription")),
      new HumanMessage({
        content: [
          { type: "text", text: "Write out exactly what is said in this recording." },
          { type: "audio", source_type: "base64", mime_type: audio.mimeType, data: audio.data.toString("base64") },
        ],
      }),
    ],
    temperature: TRANSCRIPTION_TEMPERATURE,
    providers: ["gemini"],
    timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    signal,
    validate: (output) => (output.contains_speech && !output.transcript.trim() ? "speech detected but nothing written out" : null),
  })
  // Gemini saying "nobody spoke" is an answer about the recording, not a failure to hand on
  return data.contains_speech ? data.transcript : null
}

/**
 * Turns a recording into text, Gemini first and OpenAI's transcription model (from ENV) as the
 * fallback, so a spoken description still works when Gemini is unconfigured, failing or out of
 * quota. Whatever the provider hands back is only the words that were said; the rest of the
 * module works from that plain text.
 */
export async function transcribeRequest({ audio, signal }: TranscribeOptions): Promise<string> {
  const canFallBack = isTranscriptionConfigured()
  let transcript: string | null = null

  if (isProviderConfigured("gemini")) {
    try {
      transcript = await readWithGemini(audio, signal)
    } catch (error: unknown) {
      if (signal.aborted || !canFallBack) throw error
      console.warn("⚠️ gemini could not read the recording, falling back to openai:", error instanceof Error ? error.message : error)
    }
  } else if (!canFallBack) {
    throw new UserFacingError(PROMPT_CREATOR_MESSAGES.voiceUnavailable)
  }

  // Gemini failed, or heard nothing at all, so OpenAI reads the same recording
  if (transcript === null && canFallBack) {
    transcript = await transcribeWithOpenAI(audio, signal).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.error("❌ openai could not read the recording:", error instanceof Error ? error.message : error)
      throw new UserFacingError(PROMPT_CREATOR_MESSAGES.transcriptionFailed)
    })
  }

  const written = (transcript ?? "").trim()
  // "Nothing was said" is a valid answer about the recording, not a provider failure
  if (written.length < MIN_TRANSCRIPT_LENGTH) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.unclearAudio)
  return written
}

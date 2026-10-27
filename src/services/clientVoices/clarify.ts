import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { cleanGeneratedText, stripMarkdownMarks } from "@/lib/generatedText"
import { CLEAR_POINTS_MAX, CLEAR_POINT_MAX_LENGTH, VOICE_BATCH_MAX } from "@/constants/clientVoices"
import type { ClearVoice, TranscriptInput } from "@/types/clientVoices"

/**
 * Every voice of a batch said again in clear words.
 *
 * A transcript is what was said, word for word: a client talking into their phone repeats
 * themselves, trails off, and says the important thing in the middle of a sentence about something
 * else. This writes the same voice out as a few short points, so what they actually said can be
 * read at a glance, beside the transcript rather than instead of it.
 *
 * **It is not the task list.** The lists are what the whole batch came down to; this is one voice,
 * in order, including the things that are not work at all. And it adds nothing: every point has to
 * be something the voice really said.
 *
 * **It is its own call, beside the lists rather than inside them**, and a safe one: a batch whose
 * clear words could not be written still gets its tasks and its questions, which is the thing the
 * module exists for (`assessLeadSignalsSafely` is the same arrangement).
 */

// Saying the same thing in plainer words leaves no room for invention
const CLARIFY_TEMPERATURE = 0.2
const MIN_POINT_LENGTH = 3

const ClearSchema = z.object({
  voices: z
    .array(
      z.object({
        voice: z.number().int().describe("Which voice this is, 1-based, exactly as it was labelled"),
        points: z
          .array(z.string())
          .describe(
            "What this one voice said, as short plain lines in the order they said it. One thing per line, in clear simple English, adding nothing they did not say"
          ),
      })
    )
    .describe("One entry per voice given, in the same order"),
})

/**
 * One point, tidied: the bullet or number the model wrote in front of it taken off, and a capital
 * at the front, because a list of lines that start in lower case reads as half a sentence each.
 */
function clean(raw: string): string {
  const text = stripMarkdownMarks(cleanGeneratedText(raw))
    .replace(/^[-*•\d.)\s]+/, "")
    .trim()
    .slice(0, CLEAR_POINT_MAX_LENGTH)
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text
}

interface ClarifyOptions {
  voices: TranscriptInput[]
  signal: AbortSignal
}

/**
 * Writes every voice out in clear points. Answers an empty list rather than throwing: this runs
 * beside the lists, and a batch must never lose them because this one could not be written (the
 * prompts missing from the database, a provider refusing, a voice nobody could make sense of).
 */
export async function clarifyVoicesSafely({ voices, signal }: ClarifyOptions): Promise<ClearVoice[]> {
  if (voices.length === 0) return []
  try {
    // Both are fixed prompts, like the app's other rules: they are changed in the database
    const prompt = await loadPrompt("client-voice-clear")
    const system = renderPrompt(await loadPrompt("client-voice-clear-system"), {
      VOICE_COUNT: voices.length,
      MAX_POINTS: CLEAR_POINTS_MAX,
      MAX_VOICES: VOICE_BATCH_MAX,
    })
    const transcripts = voices
      .slice()
      .sort((a, b) => a.voice - b.voice)
      .map((entry) => `Voice ${entry.voice}:\n${entry.transcript.trim()}`)
      .join("\n\n")

    const user = await composePromptMessage(
      prompt,
      [
        {
          variable: "transcripts",
          tag: "client_voice_transcripts",
          label: "What the client said, one block per voice message",
          content: transcripts,
        },
      ],
      { voice_count: String(voices.length) }
    )

    const { data, provider } = await generateStructuredWithFallback({
      schema: ClearSchema,
      name: "client_voice_clear",
      messages: [new SystemMessage(system), new HumanMessage(user)],
      temperature: CLARIFY_TEMPERATURE,
      signal,
    })

    // A voice number the model invented would put words against a voice the client never sent
    const given = new Set(voices.map((entry) => entry.voice))
    const clear = data.voices
      .filter((entry) => given.has(entry.voice))
      .map((entry) => ({
        voice: entry.voice,
        points: entry.points.map(clean).filter((point) => point.length >= MIN_POINT_LENGTH).slice(0, CLEAR_POINTS_MAX),
      }))
      .filter((entry) => entry.points.length > 0)

    // Lengths only: what a client said is theirs, so none of it goes to the log
    console.info("Client voices written out in clear words:", JSON.stringify({ provider, voices: voices.length, clarified: clear.length }))
    return clear
  } catch (error: unknown) {
    if (signal.aborted) return []
    console.error("❌ Could not write the client's voices out in clear words:", error instanceof Error ? error.message : error)
    return []
  }
}

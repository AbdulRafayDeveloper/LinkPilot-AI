import { z } from "zod"
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { humanizeTexts } from "@/services/humanizer"
import { cleanGeneratedText as cleanNote, containsPlaceholder } from "@/lib/generatedText"
import {
  CONNECTION_NOTE_MAX_CHARS,
  getToneLabel,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { GeneratedConnectionNote } from "@/types/connectionNote"
import { getActiveTonePrompt } from "./prompts"

// Slightly creative so notes read naturally rather than templated
const WRITING_TEMPERATURE = 0.7

const NoteSchema = z.object({
  note: z.string().describe("The complete connection note text, nothing else"),
})

interface GenerateOptions {
  profileData: string
  tone: ConnectionNoteToneId
  signal: AbortSignal
}

function findUnusableReason({ note }: { note: string }): string | null {
  const cleaned = cleanNote(note)
  if (!cleaned) return "empty note"
  if (containsPlaceholder(cleaned)) return "note contains a placeholder"
  return null
}

/**
 * Keeps the three instruction layers separate: application rules in the system message,
 * the saved tone prompt as the user's instructions, and the pasted profile inside
 * delimiter tags it cannot close. {{profile_data}} places the profile block where the
 * prompt wants it; otherwise the block is appended. {{tone}} inserts the tone name.
 */
function buildMessages(tonePrompt: string, tone: ConnectionNoteToneId, profileData: string): BaseMessage[] {
  const system = renderPrompt(loadPrompt("connection-note-system"), { MAX_CHARS: CONNECTION_NOTE_MAX_CHARS })
  const userMessage = composePromptMessage(
    tonePrompt,
    [{ variable: "profile_data", tag: "profile_data", label: "Profile", content: profileData }],
    { tone: getToneLabel(tone) }
  )
  return [new SystemMessage(system), new HumanMessage(userMessage)]
}

function lengthWarning(length: number): string | null {
  return length > CONNECTION_NOTE_MAX_CHARS
    ? `This note is ${length} characters, over LinkedIn's ${CONNECTION_NOTE_MAX_CHARS}-character limit. Shorten it before sending.`
    : null
}

/**
 * Generates one note with the latest saved prompt for the tone. If the note exceeds
 * LinkedIn's limit, one controlled rewrite is attempted instead of truncating the text.
 * The final note is rewritten with the Humanization prompt.
 */
export async function generateConnectionNote({ profileData, tone, signal }: GenerateOptions): Promise<GeneratedConnectionNote> {
  const tonePrompt = await getActiveTonePrompt(tone)
  const messages = buildMessages(tonePrompt, tone, profileData)

  const first = await generateStructuredWithFallback({
    schema: NoteSchema,
    name: "connection_note",
    messages,
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  })
  let note = cleanNote(first.data.note)
  let provider = first.provider

  if (note.length > CONNECTION_NOTE_MAX_CHARS) {
    const rewrite = await generateStructuredWithFallback({
      schema: NoteSchema,
      name: "connection_note",
      messages: [
        ...messages,
        new HumanMessage(
          `Your draft below is ${note.length} characters. Rewrite it in at most ${CONNECTION_NOTE_MAX_CHARS} characters including spaces. Keep the same tone, personalization and meaning, and end on a complete sentence.\n\n<draft_note>\n${note}\n</draft_note>`
        ),
      ],
      temperature: WRITING_TEMPERATURE,
      signal,
      validate: findUnusableReason,
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Connection note length rewrite failed; returning the original draft:", error)
      return null
    })

    const shorter = rewrite ? cleanNote(rewrite.data.note) : ""
    if (rewrite && shorter.length < note.length) {
      note = shorter
      provider = rewrite.provider
    }
  }

  const humanization = await humanizeTexts({
    fields: [{ id: "note", kind: "LinkedIn connection request note", text: note, maxChars: CONNECTION_NOTE_MAX_CHARS }],
    signal,
  })
  note = humanization.texts.note

  console.info(
    "Connection note generated:",
    JSON.stringify({ tone, provider, humanized: humanization.humanized, characters: note.length })
  )
  return {
    note,
    tone,
    characterCount: note.length,
    maxCharacters: CONNECTION_NOTE_MAX_CHARS,
    warning: lengthWarning(note.length),
  }
}

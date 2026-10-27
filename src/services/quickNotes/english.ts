import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { UserFacingError } from "@/lib/errors"
import { NOTE_SPEECH_MAX_LENGTH, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { SpokenNoteEnglish } from "@/types/quickNotes"

/**
 * A spoken note, written in clear English before it goes into the editor.
 *
 * The owner speaks the way they think, often Roman Urdu, Urdu and English in one sentence, and
 * Whisper writes that out word for word, false starts and all. A note is kept to be read again
 * later, so this writes the same note in plain English: every name, number, link and step kept,
 * nothing added, and nothing in it obeyed, since what was said is data in its own tags.
 *
 * It is not Message Rewriter, which shortens a message to send, and not Prompt Creator's English
 * reading, whose rules are about a task description: a note is anything at all, so its own fixed
 * rules live in `quick-notes-english-system` and the wording the owner may change in `quick-notes-english`.
 */

const englishSchema = (book: PromptBook) =>
  z.object({
    english: z.string().describe(book.text("field.english")),
    sourceLanguage: z.string().describe(book.text("field.source-language")),
  })

/**
 * Writes what was spoken in English. Throws a `UserFacingError` when there is nothing to read or
 * the models answer with nothing usable, so the page keeps what was said and says why.
 *
 * Call it inside `runAiRequest(viewer, "quick-notes", …)`, so it follows the module's provider
 * order and is counted with the module's speech.
 */
export async function spokenNoteToEnglish(text: string, signal?: AbortSignal): Promise<SpokenNoteEnglish> {
  const spoken = text.trim()
  if (!spoken) throw new UserFacingError(QUICK_NOTES_MESSAGES.speechMissing)
  if (spoken.length > NOTE_SPEECH_MAX_LENGTH) throw new UserFacingError(QUICK_NOTES_MESSAGES.speechTooLong)

  const [system, instructions, book] = await Promise.all([
    loadPrompt("quick-notes-english-system"),
    loadPrompt("quick-notes-english"),
    loadPromptBook("quick-notes-instructions"),
  ])
  const message = await composePromptMessage(instructions, [
    { variable: "note", tag: "spoken_note", label: book.text("label.note"), content: spoken },
  ])

  const { data } = await generateStructuredWithFallback({
    schema: englishSchema(book),
    name: "spoken_note_in_english",
    messages: [new SystemMessage(system), new HumanMessage(message)],
    // A faithful reading, not a new note: a low temperature keeps it close to what was said
    temperature: 0.2,
    signal,
    validate: (draft) => (draft.english.trim().length > 0 ? null : "the English version came back empty"),
  })

  return { english: data.english.trim(), sourceLanguage: data.sourceLanguage.trim() || "Unknown" }
}

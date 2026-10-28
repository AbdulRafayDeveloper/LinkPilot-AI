import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { transcribeRecording } from "@/services/transcribeAudio"
import { runAiRequest } from "@/services/modelPriority"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { ClientProjectTaskModel } from "@/models/ClientProjectTask"
import { PROJECT_TASK_MESSAGES, VOICE_TEXT_MAX_CHARS, projectItemShape } from "@/constants/clientProjectTasks"
import { projectOrNull, publicWritableTaskById, toTask, type StoredTask } from "./tasks"
import { projectFromToken } from "./projects"
import { voiceNoteBytes } from "./voiceNotes"
import type { PublicWrite } from "./publicTasks"
import { visibleById } from "@/services/auth/viewer"
import { ACCOUNT_FIELDS, viewerOf, type Account } from "@/services/auth/accountViewer"
import { readFeatureDefaults } from "@/services/featureSettings"
import { UserModel } from "@/models/User"
import type { AiSource } from "@/types/ai"
import type { ProjectTask } from "@/types/clientProjectTasks"
import type { Viewer } from "@/types/auth"

/**
 * An overview voice written out and read back in clear English, at the owner's request: a client
 * explains their project by voice, often in Urdu or Roman Urdu and English in one sentence, and the
 * overview should read clearly, the way Client Voices turns a voice into a transcript.
 *
 * Two steps on the recording already kept on the item: Whisper writes out what was said, word for
 * word (Groq, then OpenAI, the module's own order), and a model reads it back in plain English with
 * every name, number and detail kept, nothing added and nothing in it obeyed. **Every word the model
 * reads comes from the prompts** (`client-project-voice-english-system`, the fixed rules;
 * `client-project-voice-english`, the wording an admin may change; `client-projects-instructions`,
 * the labels and what each answer field means), managed under Administration → Global AI Prompts.
 *
 * The result is kept on the item beside the recording it was written from (`voiceTextFor`), so a
 * voice recorded again reads as not written out yet rather than carrying the old words.
 */

const englishSchema = (book: PromptBook) =>
  z.object({
    english: z.string().describe(book.text("field.english")),
    sourceLanguage: z.string().describe(book.text("field.source-language")),
  })

/** What was said, read back in clear English. Call inside `runAiRequest`. */
async function voiceToEnglish(spoken: string, name: string, signal: AbortSignal): Promise<{ english: string; sourceLanguage: string }> {
  const [system, instructions, book] = await Promise.all([
    loadPrompt("client-project-voice-english-system"),
    loadPrompt("client-project-voice-english"),
    loadPromptBook("client-projects-instructions"),
  ])
  const message = await composePromptMessage(instructions, [
    { variable: "name", tag: "voice_name", label: book.text("label.name"), content: name },
    { variable: "voice", tag: "spoken_voice", label: book.text("label.voice"), content: spoken },
  ])
  const { data } = await generateStructuredWithFallback({
    schema: englishSchema(book),
    name: "project_voice_in_english",
    messages: [new SystemMessage(system), new HumanMessage(message)],
    // A faithful reading of what was said, not a new text: a low temperature keeps it close
    temperature: 0.2,
    signal,
    validate: (draft) => (draft.english.trim().length > 0 ? null : "the English version came back empty"),
  })
  return { english: data.english.trim(), sourceLanguage: data.sourceLanguage.trim() || "Unknown" }
}

/**
 * Writes one item's voice out in English and keeps it on the item. `filter` names the item and
 * whoever may reach it (an account's own scope, or a shared link's public kinds); `viewer` is the
 * account the model calls are made and counted for, which on a shared link is the project's owner.
 * Null when the item is gone or out of reach.
 */
export async function writeVoiceText(
  filter: Record<string, unknown>,
  projectId: string,
  viewer: Viewer,
  signal: AbortSignal
): Promise<{ task: ProjectTask; source: AiSource } | null> {
  await connectDatabase()
  const record = (await ClientProjectTaskModel.findOne({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!record) return null
  if (!projectItemShape(record.kind).voiceText) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextNotHere)
  const note = record.voiceNote
  if (!note?.assetId) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextNoVoice)

  const bytes = await voiceNoteBytes(note, signal)
  const mimeType = bytes ? detectAudioMimeType(bytes) : null
  if (!bytes || !mimeType) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextNoVoice)

  const { result, source } = await runAiRequest(viewer, "client-projects", async () => {
    const transcript = await transcribeRecording({ audio: { data: bytes, mimeType }, signal })
    const spoken = transcript.text.trim()
    if (!spoken) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextNoSpeech)
    if (spoken.length > VOICE_TEXT_MAX_CHARS) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextTooLong)
    const english = await voiceToEnglish(spoken, record.content, signal)
    return { spoken, ...english }
  })

  // Written only while the item still carries the recording that was read, so a voice replaced
  // while the model was answering is never labelled with words from the old one
  const updated = (await ClientProjectTaskModel.findOneAndUpdate(
    { _id: record._id, "voiceNote.assetId": note.assetId },
    {
      $set: {
        voiceTranscript: result.spoken,
        voiceEnglish: result.english,
        voiceLanguage: result.sourceLanguage,
        voiceTextProvider: source.provider ?? null,
        voiceTextFor: note.assetId,
      },
    },
    { new: true }
  ).lean()) as unknown as StoredTask | null
  if (!updated) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTextChanged)
  // What was said is never written to the log, only how long it was and what it was read from
  console.log("Project voice written in English", { chars: result.spoken.length, language: result.sourceLanguage, provider: source.provider })
  return { task: await toTask(updated), source }
}

/** The signed-in owner writes one of their own items' voice out. Null when the item or project is out of reach. */
export async function writeOwnVoiceText(viewer: Viewer, projectId: string, taskId: string, signal: AbortSignal) {
  const filter = visibleById(viewer, taskId)
  const project = filter ? await projectOrNull(viewer, projectId) : null
  if (!filter || !project) return null
  return writeVoiceText(filter, projectId, viewer, signal)
}

/**
 * Someone holding the shared link writes an overview voice out, as the owner asked. They are signed in
 * to nothing, so the model calls are made, ordered and counted for **the project's owner**, whose
 * project it is; the token is still the whole of what lets the call happen, so turning the link off
 * stops it, and the item has to be one the link may write on.
 */
export async function writePublicVoiceText(token: string, taskId: string, signal: AbortSignal): Promise<PublicWrite<{ task: ProjectTask; source: AiSource }>> {
  const project = await projectFromToken(token)
  if (!project?.ownerId) return { ok: false, reason: "link" }
  const filter = publicWritableTaskById(taskId)
  if (!filter) return { ok: false, reason: "item" }
  const [owner, defaults] = await Promise.all([UserModel.findById(project.ownerId, ACCOUNT_FIELDS).lean(), readFeatureDefaults()])
  if (!owner) return { ok: false, reason: "link" }
  const written = await writeVoiceText(filter, project._id.toString(), await viewerOf(owner as unknown as Account, defaults), signal)
  return written ? { ok: true, value: written } : { ok: false, reason: "item" }
}
